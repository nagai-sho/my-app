import { z } from 'zod';

import type { AppEnv } from '../env';
import { jsonResponse } from '../http';

const API_PREFIX = '/api/v1/arch-draft-app';
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const MAX_TEMPLATE_BYTES = 2 * 1024 * 1024;
const ALLOWED_SOURCE_EXTENSIONS = new Set(['jww', 'jwc']);
const TEMPLATE_MIME_TYPE = 'text/plain; charset=utf-8';

const createDrawingSchema = z.object({
  templateId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  variables: z.record(z.string(), z.union([z.string(), z.number()])),
});

interface TemplateVariable {
  key: string;
  label: string;
  type: 'string';
  required: boolean;
  default: string;
}

interface TemplateRow {
  id: string;
  name: string;
  description: string;
  template_file_id: string;
  variables_json: string;
  created_at: number;
  updated_at: number;
  r2_key: string;
  file_name: string;
}

interface FileRow {
  id: string;
  owner_id: string;
  kind: 'source' | 'converted' | 'template';
  file_name: string;
  mime_type: string;
  ext: string;
  byte_size: number;
  r2_key: string;
  created_at: number;
}

interface VersionRow {
  id: string;
  drawing_id: string;
  version_no: number;
  source_file_id: string;
  meta_json: string;
  created_at: number;
  file_name: string;
  mime_type: string;
  byte_size: number;
}

interface JobRow {
  id: string;
  drawing_version_id: string;
  target_format: 'dxf';
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
  output_file_id: string | null;
  error_message: string | null;
  converter_mode: string;
  created_at: number;
  updated_at: number;
  output_file_name: string | null;
}

class ArchDraftInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArchDraftInputError';
  }
}

export async function handleArchDraftRequest(
  request: Request,
  env: AppEnv,
  ownerId: string,
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS' } });
  }

  const path = new URL(request.url).pathname.slice(API_PREFIX.length).replace(/\/$/, '') || '/';

  try {
    if (path === '/templates' && request.method === 'GET') return listTemplates(env, ownerId);
    if (path === '/templates' && request.method === 'POST') return createTemplate(request, env, ownerId);
    if (path === '/drawings' && request.method === 'GET') return listDrawings(env, ownerId);
    if (path === '/drawings' && request.method === 'POST') return createDrawingFromTemplate(request, env, ownerId);
    if (path === '/drawings/upload' && request.method === 'POST') return uploadDrawing(request, env, ownerId);
    if (path === '/jobs' && request.method === 'POST') return createConversionJob(request, env, ownerId);

    const drawingMatch = path.match(/^\/drawings\/([^/]+)$/);
    if (drawingMatch && request.method === 'GET') {
      return drawingDetail(env, ownerId, decodePathSegment(drawingMatch[1]));
    }

    const downloadMatch = path.match(/^\/files\/([^/]+)\/download$/);
    if (downloadMatch && request.method === 'GET') {
      return downloadFile(env, ownerId, decodePathSegment(downloadMatch[1]));
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0]?.message || '入力内容を確認してください。', 400);
    }
    if (error instanceof ArchDraftInputError) return errorResponse(error.message, 400);

    console.error(JSON.stringify({
      level: 'error',
      feature: 'arch-draft-app',
      event: 'api_request_failed',
      path,
      message: error instanceof Error ? error.message : String(error),
    }));
    return errorResponse('図面の処理に失敗しました。', 500);
  }
}

async function listTemplates(env: AppEnv, ownerId: string): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT t.id, t.name, t.description, t.template_file_id, t.variables_json, t.created_at, t.updated_at,
            f.r2_key, f.file_name
       FROM arch_draft_templates t
       JOIN arch_draft_files f ON f.id = t.template_file_id
      WHERE t.owner_id = ?
      ORDER BY t.updated_at DESC, t.name COLLATE NOCASE ASC`,
  ).bind(ownerId).all<TemplateRow>();

  return jsonResponse<AppEnv>({ templates: (results ?? []).map(serializeTemplate) });
}

async function createTemplate(request: Request, env: AppEnv, ownerId: string): Promise<Response> {
  const form = await request.formData();
  const name = textField(form.get('name'), 'テンプレート名を入力してください。', 100);
  const description = optionalTextField(form.get('description'), 500);
  const file = form.get('file');
  if (!(file instanceof File)) throw new ArchDraftInputError('JWテンプレートファイルを選択してください。');

  const fileMeta = getFileMeta(file.name, file.type || TEMPLATE_MIME_TYPE);
  if (!ALLOWED_SOURCE_EXTENSIONS.has(fileMeta.ext)) {
    throw new ArchDraftInputError('テンプレートは .jww または .jwc ファイルを選択してください。');
  }
  if (file.size > MAX_TEMPLATE_BYTES) {
    throw new ArchDraftInputError('テンプレートは2MB以下にしてください。');
  }
  if (file.size === 0) throw new ArchDraftInputError('空のテンプレートは登録できません。');

  const contents = new Uint8Array(await file.arrayBuffer());
  let templateText: string;
  try {
    templateText = new TextDecoder('utf-8', { fatal: true }).decode(contents);
  } catch {
    throw new ArchDraftInputError('テンプレートはUTF-8のテキスト形式で保存してください。');
  }

  const now = nowMilliseconds();
  const templateId = crypto.randomUUID();
  const fileId = crypto.randomUUID();
  const key = `arch-draft-app/templates/${templateId}/${fileId}.${fileMeta.ext}`;
  const variables = getTemplateVariables(templateText);

  await env.ARCH_DRAFT_R2.put(key, contents, {
    httpMetadata: { contentType: TEMPLATE_MIME_TYPE },
  });

  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO arch_draft_files
          (id, owner_id, kind, file_name, mime_type, ext, byte_size, r2_key, created_at)
         VALUES (?, ?, 'template', ?, ?, ?, ?, ?, ?)`,
      ).bind(fileId, ownerId, fileMeta.fileName, TEMPLATE_MIME_TYPE, fileMeta.ext, contents.byteLength, key, now),
      env.DB.prepare(
        `INSERT INTO arch_draft_templates
          (id, owner_id, name, description, template_file_id, variables_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(templateId, ownerId, name, description, fileId, JSON.stringify(variables), now, now),
    ]);
  } catch (error) {
    await env.ARCH_DRAFT_R2.delete(key);
    throw error;
  }

  return jsonResponse<AppEnv>({
    template: {
      id: templateId,
      name,
      description,
      fileName: fileMeta.fileName,
      variables,
      createdAt: now,
      updatedAt: now,
    },
  }, 201);
}

async function listDrawings(env: AppEnv, ownerId: string): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT d.id, d.title, d.template_id, d.created_at, d.updated_at,
            t.name AS template_name,
            (SELECT COUNT(*) FROM arch_draft_versions v WHERE v.drawing_id = d.id) AS version_count,
            (SELECT v.version_no FROM arch_draft_versions v
              WHERE v.drawing_id = d.id ORDER BY v.version_no DESC LIMIT 1) AS latest_version,
            (SELECT f.file_name FROM arch_draft_versions v
              JOIN arch_draft_files f ON f.id = v.source_file_id
              WHERE v.drawing_id = d.id ORDER BY v.version_no DESC LIMIT 1) AS latest_file_name,
            (SELECT j.status FROM arch_draft_jobs j
              JOIN arch_draft_versions v ON v.id = j.drawing_version_id
              WHERE v.drawing_id = d.id ORDER BY j.updated_at DESC LIMIT 1) AS latest_job_status
       FROM arch_draft_drawings d
       LEFT JOIN arch_draft_templates t ON t.id = d.template_id
      WHERE d.owner_id = ?
      ORDER BY d.updated_at DESC, d.title COLLATE NOCASE ASC
      LIMIT 100`,
  ).bind(ownerId).all<{
    id: string;
    title: string;
    template_id: string | null;
    template_name: string | null;
    version_count: number;
    latest_version: number | null;
    latest_file_name: string | null;
    latest_job_status: JobRow['status'] | null;
    created_at: number;
    updated_at: number;
  }>();

  return jsonResponse<AppEnv>({
    drawings: (results ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      templateId: row.template_id,
      templateName: row.template_name,
      versionCount: Number(row.version_count),
      latestVersion: row.latest_version === null ? null : Number(row.latest_version),
      latestFileName: row.latest_file_name,
      latestJobStatus: row.latest_job_status,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    })),
  });
}

async function createDrawingFromTemplate(request: Request, env: AppEnv, ownerId: string): Promise<Response> {
  const input = createDrawingSchema.parse(await readJson(request));
  const template = await templateById(env, ownerId, input.templateId);
  if (!template) return errorResponse('テンプレートが見つかりません。', 404);

  const templateObject = await env.ARCH_DRAFT_R2.get(template.r2_key);
  if (!templateObject) return errorResponse('テンプレートファイルが見つかりません。', 404);

  let templateText: string;
  try {
    templateText = new TextDecoder('utf-8', { fatal: true }).decode(await templateObject.arrayBuffer());
  } catch {
    return errorResponse('テンプレートの文字コードを読み取れません。', 400);
  }

  const variables = parseTemplateVariables(template.variables_json);
  const knownKeys = new Set(variables.map((variable) => variable.key));
  for (const variable of variables) {
    const value = input.variables[variable.key];
    if (variable.required && (value === undefined || String(value).trim() === '')) {
      throw new ArchDraftInputError(`「${variable.label}」を入力してください。`);
    }
  }
  if (Object.keys(input.variables).some((key) => !knownKeys.has(key))) {
    throw new ArchDraftInputError('テンプレートにない変数が含まれています。');
  }

  const generatedText = templateText.replace(/\$\{([A-Z][A-Z0-9_]*)\}/g, (placeholder, key: string) => {
    const value = input.variables[key];
    return value === undefined ? placeholder : String(value);
  });
  const generated = new TextEncoder().encode(generatedText);
  if (generated.byteLength > MAX_TEMPLATE_BYTES) {
    throw new ArchDraftInputError('生成後のテンプレートは2MB以下にしてください。');
  }

  const drawingId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const fileId = crypto.randomUUID();
  const now = nowMilliseconds();
  const outputExt = getFileMeta(template.file_name, TEMPLATE_MIME_TYPE).ext;
  const fileName = `${safeFileStem(input.title)}.${outputExt}`;
  const key = `arch-draft-app/drawings/${drawingId}/versions/1/${fileId}.${outputExt}`;
  await env.ARCH_DRAFT_R2.put(key, generated, {
    httpMetadata: { contentType: TEMPLATE_MIME_TYPE },
  });

  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO arch_draft_drawings (id, owner_id, title, template_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(drawingId, ownerId, input.title, template.id, now, now),
      env.DB.prepare(
        `INSERT INTO arch_draft_files
          (id, owner_id, kind, file_name, mime_type, ext, byte_size, r2_key, created_at)
         VALUES (?, ?, 'source', ?, ?, ?, ?, ?, ?)`,
      ).bind(fileId, ownerId, fileName, TEMPLATE_MIME_TYPE, outputExt, generated.byteLength, key, now),
      env.DB.prepare(
        `INSERT INTO arch_draft_versions
          (id, owner_id, drawing_id, version_no, source_file_id, meta_json, created_at)
         VALUES (?, ?, ?, 1, ?, ?, ?)`,
      ).bind(versionId, ownerId, drawingId, fileId, JSON.stringify({ templateId: template.id, variables: input.variables }), now),
    ]);
  } catch (error) {
    await env.ARCH_DRAFT_R2.delete(key);
    throw error;
  }

  return jsonResponse<AppEnv>({
    drawing: { id: drawingId, title: input.title, templateId: template.id, createdAt: now, updatedAt: now },
    version: { id: versionId, versionNo: 1, sourceFileId: fileId, fileName, byteSize: generated.byteLength, createdAt: now },
  }, 201);
}

async function uploadDrawing(request: Request, env: AppEnv, ownerId: string): Promise<Response> {
  const url = new URL(request.url);
  const fileNameValue = request.headers.get('x-file-name') ?? url.searchParams.get('file_name');
  if (!fileNameValue) throw new ArchDraftInputError('ファイル名を確認できません。');
  const fileMeta = getFileMeta(decodeURIComponentSafe(fileNameValue), request.headers.get('content-type') || 'application/octet-stream');
  if (!ALLOWED_SOURCE_EXTENSIONS.has(fileMeta.ext)) {
    throw new ArchDraftInputError('図面は .jww または .jwc ファイルを選択してください。');
  }
  const uploadStream = request.body;
  if (!uploadStream) throw new ArchDraftInputError('アップロードするファイルが空です。');

  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BYTES) {
    throw new ArchDraftInputError('ファイルは100MB以下にしてください。');
  }

  const title = (url.searchParams.get('title') ?? fileMeta.fileName.replace(/\.[^.]+$/, '')).trim().slice(0, 160);
  if (!title) throw new ArchDraftInputError('図面名を入力してください。');

  const drawingIdParam = url.searchParams.get('drawing_id');
  let drawingId = drawingIdParam;
  let versionNo = 1;
  if (drawingId) {
    const drawing = await env.DB.prepare(
      'SELECT id FROM arch_draft_drawings WHERE id = ? AND owner_id = ? LIMIT 1',
    ).bind(drawingId, ownerId).first<{ id: string }>();
    if (!drawing) return errorResponse('図面が見つかりません。', 404);
    const current = await env.DB.prepare(
      'SELECT COALESCE(MAX(version_no), 0) AS version_no FROM arch_draft_versions WHERE drawing_id = ?',
    ).bind(drawingId).first<{ version_no: number }>();
    versionNo = Number(current?.version_no ?? 0) + 1;
  } else {
    drawingId = crypto.randomUUID();
  }

  const fileId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const now = nowMilliseconds();
  const key = `arch-draft-app/drawings/${drawingId}/versions/${versionNo}/${fileId}.${fileMeta.ext}`;
  let byteSize = 0;
  const body = limitedStream(uploadStream, MAX_UPLOAD_BYTES, (chunkSize) => { byteSize += chunkSize; });

  try {
    await env.ARCH_DRAFT_R2.put(key, body, {
      httpMetadata: { contentType: fileMeta.mimeType },
    });
    if (byteSize === 0) throw new ArchDraftInputError('空の図面ファイルは保存できません。');
  } catch (error) {
    await env.ARCH_DRAFT_R2.delete(key);
    throw error;
  }

  try {
    const statements = [];
    if (!drawingIdParam) {
      statements.push(env.DB.prepare(
        `INSERT INTO arch_draft_drawings (id, owner_id, title, template_id, created_at, updated_at)
         VALUES (?, ?, ?, NULL, ?, ?)`,
      ).bind(drawingId, ownerId, title, now, now));
    }
    statements.push(
      env.DB.prepare(
        `INSERT INTO arch_draft_files
          (id, owner_id, kind, file_name, mime_type, ext, byte_size, r2_key, created_at)
         VALUES (?, ?, 'source', ?, ?, ?, ?, ?, ?)`,
      ).bind(fileId, ownerId, fileMeta.fileName, fileMeta.mimeType, fileMeta.ext, byteSize, key, now),
      env.DB.prepare(
        `INSERT INTO arch_draft_versions
          (id, owner_id, drawing_id, version_no, source_file_id, meta_json, created_at)
         VALUES (?, ?, ?, ?, ?, '{}', ?)`,
      ).bind(versionId, ownerId, drawingId, versionNo, fileId, now),
      env.DB.prepare('UPDATE arch_draft_drawings SET updated_at = ? WHERE id = ? AND owner_id = ?')
        .bind(now, drawingId, ownerId),
    );
    await env.DB.batch(statements);
  } catch (error) {
    await env.ARCH_DRAFT_R2.delete(key);
    throw error;
  }

  return jsonResponse<AppEnv>({
    drawing: { id: drawingId, title, createdAt: now, updatedAt: now },
    version: { id: versionId, versionNo, sourceFileId: fileId, fileName: fileMeta.fileName, byteSize, createdAt: now },
  }, 201);
}

async function drawingDetail(env: AppEnv, ownerId: string, drawingId: string): Promise<Response> {
  const drawing = await env.DB.prepare(
    `SELECT d.id, d.title, d.template_id, d.created_at, d.updated_at, t.name AS template_name
       FROM arch_draft_drawings d
       LEFT JOIN arch_draft_templates t ON t.id = d.template_id
      WHERE d.id = ? AND d.owner_id = ?
      LIMIT 1`,
  ).bind(drawingId, ownerId).first<{
    id: string;
    title: string;
    template_id: string | null;
    template_name: string | null;
    created_at: number;
    updated_at: number;
  }>();
  if (!drawing) return errorResponse('図面が見つかりません。', 404);

  const { results: versions } = await env.DB.prepare(
    `SELECT v.id, v.drawing_id, v.version_no, v.source_file_id, v.meta_json, v.created_at,
            f.file_name, f.mime_type, f.byte_size
       FROM arch_draft_versions v
       JOIN arch_draft_files f ON f.id = v.source_file_id
      WHERE v.drawing_id = ? AND v.owner_id = ?
      ORDER BY v.version_no DESC`,
  ).bind(drawingId, ownerId).all<VersionRow>();

  const versionIds = (versions ?? []).map((version) => version.id);
  const jobsByVersion = new Map<string, Array<Record<string, unknown>>>();
  if (versionIds.length > 0) {
    const placeholders = versionIds.map(() => '?').join(', ');
    const { results: jobs } = await env.DB.prepare(
      `SELECT j.id, j.drawing_version_id, j.target_format, j.status, j.output_file_id,
              j.error_message, j.converter_mode, j.created_at, j.updated_at,
              f.file_name AS output_file_name
         FROM arch_draft_jobs j
         LEFT JOIN arch_draft_files f ON f.id = j.output_file_id
        WHERE j.owner_id = ? AND j.drawing_version_id IN (${placeholders})
        ORDER BY j.created_at DESC`,
    ).bind(ownerId, ...versionIds).all<JobRow>();
    for (const job of jobs ?? []) {
      const bucket = jobsByVersion.get(job.drawing_version_id) ?? [];
      bucket.push(serializeJob(job));
      jobsByVersion.set(job.drawing_version_id, bucket);
    }
  }

  const serializedVersions = (versions ?? []).map((version) => ({
    id: version.id,
    versionNo: Number(version.version_no),
    sourceFile: {
      id: version.source_file_id,
      fileName: version.file_name,
      mimeType: version.mime_type,
      byteSize: Number(version.byte_size),
      downloadUrl: `${API_PREFIX}/files/${encodeURIComponent(version.source_file_id)}/download`,
    },
    meta: parseJsonObject(version.meta_json),
    createdAt: Number(version.created_at),
    jobs: jobsByVersion.get(version.id) ?? [],
  }));
  const mostRecentJob = (serializedVersions.flatMap((version) => version.jobs) as Array<Record<string, unknown>>)
    .sort((left, right) => Number(right.updatedAt) - Number(left.updatedAt))[0];

  return jsonResponse<AppEnv>({
    drawing: {
      id: drawing.id,
      title: drawing.title,
      templateId: drawing.template_id,
      templateName: drawing.template_name,
      versionCount: serializedVersions.length,
      latestVersion: serializedVersions[0]?.versionNo ?? null,
      latestFileName: serializedVersions[0]?.sourceFile.fileName ?? null,
      latestJobStatus: typeof mostRecentJob?.status === 'string' ? mostRecentJob.status : null,
      createdAt: Number(drawing.created_at),
      updatedAt: Number(drawing.updated_at),
      versions: serializedVersions,
    },
  });
}

async function createConversionJob(request: Request, env: AppEnv, ownerId: string): Promise<Response> {
  const body = await readJson(request);
  const versionId = typeof body.drawingVersionId === 'string' ? body.drawingVersionId : '';
  const targetFormat = body.targetFormat;
  if (!versionId) throw new ArchDraftInputError('変換する図面バージョンを指定してください。');
  if (targetFormat !== 'dxf') throw new ArchDraftInputError('現在選択できる形式はDXFです。');

  const version = await env.DB.prepare(
    `SELECT v.id, v.drawing_id, d.title, f.file_name, f.id AS source_file_id
       FROM arch_draft_versions v
       JOIN arch_draft_drawings d ON d.id = v.drawing_id
       JOIN arch_draft_files f ON f.id = v.source_file_id
      WHERE v.id = ? AND v.owner_id = ?
      LIMIT 1`,
  ).bind(versionId, ownerId).first<{
    id: string;
    drawing_id: string;
    title: string;
    file_name: string;
    source_file_id: string;
  }>();
  if (!version) return errorResponse('図面バージョンが見つかりません。', 404);

  const jobId = crypto.randomUUID();
  const outputFileId = crypto.randomUUID();
  const now = nowMilliseconds();
  const outputFileName = `${safeFileStem(version.title)}.dxf`;
  const key = `arch-draft-app/conversions/${jobId}/${outputFileId}.dxf`;
  await env.DB.prepare(
    `INSERT INTO arch_draft_jobs
      (id, owner_id, drawing_version_id, target_format, status, converter_mode, created_at, updated_at)
     VALUES (?, ?, ?, 'dxf', 'processing', 'mock', ?, ?)`,
  ).bind(jobId, ownerId, versionId, now, now).run();

  try {
    // TODO: Replace this clearly marked placeholder with the shared external CAD converter integration.
    // The current app intentionally needs no converter secrets or additional environment variables.
    const mockOutput = createMockDxf(version.file_name);
    await env.ARCH_DRAFT_R2.put(key, mockOutput, {
      httpMetadata: { contentType: 'application/dxf' },
    });
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO arch_draft_files
          (id, owner_id, kind, file_name, mime_type, ext, byte_size, r2_key, created_at)
         VALUES (?, ?, 'converted', ?, 'application/dxf', 'dxf', ?, ?, ?)`,
      ).bind(outputFileId, ownerId, outputFileName, mockOutput.byteLength, key, now),
      env.DB.prepare(
        `UPDATE arch_draft_jobs SET status = 'succeeded', output_file_id = ?, updated_at = ?
          WHERE id = ? AND owner_id = ?`,
      ).bind(outputFileId, now, jobId, ownerId),
      env.DB.prepare('UPDATE arch_draft_drawings SET updated_at = ? WHERE id = ? AND owner_id = ?')
        .bind(now, version.drawing_id, ownerId),
    ]);
  } catch (error) {
    await env.ARCH_DRAFT_R2.delete(key);
    await env.DB.prepare(
      `UPDATE arch_draft_jobs SET status = 'failed', error_message = ?, updated_at = ?
        WHERE id = ? AND owner_id = ?`,
    ).bind('DXFの仮ファイルを作成できませんでした。', nowMilliseconds(), jobId, ownerId).run();
    console.error(JSON.stringify({
      level: 'error',
      feature: 'arch-draft-app',
      event: 'mock_conversion_failed',
      jobId,
      message: error instanceof Error ? error.message : String(error),
    }));
  }

  const job = await env.DB.prepare(
    `SELECT j.id, j.drawing_version_id, j.target_format, j.status, j.output_file_id,
            j.error_message, j.converter_mode, j.created_at, j.updated_at,
            f.file_name AS output_file_name
       FROM arch_draft_jobs j LEFT JOIN arch_draft_files f ON f.id = j.output_file_id
      WHERE j.id = ? AND j.owner_id = ? LIMIT 1`,
  ).bind(jobId, ownerId).first<JobRow>();

  return jsonResponse<AppEnv>({ job: job ? serializeJob(job) : null }, 201);
}

async function downloadFile(env: AppEnv, ownerId: string, fileId: string): Promise<Response> {
  const file = await env.DB.prepare(
    `SELECT id, owner_id, kind, file_name, mime_type, ext, byte_size, r2_key, created_at
       FROM arch_draft_files WHERE id = ? AND owner_id = ? LIMIT 1`,
  ).bind(fileId, ownerId).first<FileRow>();
  if (!file) return errorResponse('ファイルが見つかりません。', 404);

  const object = await env.ARCH_DRAFT_R2.get(file.r2_key);
  if (!object) return errorResponse('ファイル本体が見つかりません。', 404);
  const safeName = file.file_name.replace(/[\r\n"\\]/g, '_');
  return new Response(object.body, {
    headers: {
      'Content-Type': file.mime_type,
      'Content-Length': String(file.byte_size),
      'Content-Disposition': `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(file.file_name)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function templateById(env: AppEnv, ownerId: string, templateId: string): Promise<TemplateRow | null> {
  return env.DB.prepare(
    `SELECT t.id, t.name, t.description, t.template_file_id, t.variables_json, t.created_at, t.updated_at,
            f.r2_key, f.file_name
       FROM arch_draft_templates t JOIN arch_draft_files f ON f.id = t.template_file_id
      WHERE t.id = ? AND t.owner_id = ? LIMIT 1`,
  ).bind(templateId, ownerId).first<TemplateRow>();
}

function serializeTemplate(row: TemplateRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    fileName: row.file_name,
    variables: parseTemplateVariables(row.variables_json),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function serializeJob(job: JobRow) {
  return {
    id: job.id,
    drawingVersionId: job.drawing_version_id,
    targetFormat: job.target_format,
    status: job.status,
    outputFileId: job.output_file_id,
    outputFileName: job.output_file_name,
    downloadUrl: job.output_file_id
      ? `${API_PREFIX}/files/${encodeURIComponent(job.output_file_id)}/download`
      : null,
    errorMessage: job.error_message,
    converterMode: job.converter_mode,
    createdAt: Number(job.created_at),
    updatedAt: Number(job.updated_at),
  };
}

function parseTemplateVariables(value: string): TemplateVariable[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every(isTemplateVariable)) return parsed;
  } catch {
    // A damaged optional schema should show no variables rather than break the library list.
  }
  return [];
}

function isTemplateVariable(value: unknown): value is TemplateVariable {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TemplateVariable>;
  return typeof candidate.key === 'string'
    && typeof candidate.label === 'string'
    && candidate.type === 'string'
    && typeof candidate.required === 'boolean'
    && typeof candidate.default === 'string';
}

function getTemplateVariables(contents: string): TemplateVariable[] {
  const keys = [...new Set(Array.from(contents.matchAll(/\$\{([A-Z][A-Z0-9_]*)\}/g), (match) => match[1]))];
  return keys.map((key) => ({
    key,
    label: key.replace(/_/g, ' ').toLowerCase().replace(/^./, (first) => first.toUpperCase()),
    type: 'string',
    required: true,
    default: '',
  }));
}

function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    // Metadata is a summary only; a malformed record does not prevent file access.
  }
  return {};
}

function getFileMeta(nameValue: string, mimeValue: string): { fileName: string; mimeType: string; ext: string } {
  const fileName = nameValue.split(/[\\/]/).pop()?.trim() || '';
  const extension = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() || '' : '';
  if (!fileName || fileName.length > 255 || !/^[a-z0-9]{2,5}$/.test(extension)) {
    throw new ArchDraftInputError('ファイル名または拡張子が正しくありません。');
  }
  return {
    fileName,
    mimeType: mimeValue.trim().slice(0, 150) || 'application/octet-stream',
    ext: extension,
  };
}

function createMockDxf(sourceFileName: string): Uint8Array {
  const safeSourceName = sourceFileName.replace(/[\r\n]/g, ' ').slice(0, 120);
  const contents = [
    '0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES', '999', 'arch-draft-app mock output: geometry has not been converted',
    '999', `Source file: ${safeSourceName}`, '0', 'ENDSEC', '0', 'EOF', '',
  ].join('\r\n');
  return new TextEncoder().encode(contents);
}

function limitedStream(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
  onChunk: (size: number) => void,
): ReadableStream<Uint8Array> {
  const reader = stream.getReader();
  let total = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        total += value.byteLength;
        onChunk(value.byteLength);
        if (total > maxBytes) {
          await reader.cancel();
          controller.error(new ArchDraftInputError('ファイルは100MB以下にしてください。'));
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

function textField(value: FormDataEntryValue | null, errorMessage: string, maxLength: number): string {
  if (typeof value !== 'string') throw new ArchDraftInputError(errorMessage);
  const result = value.trim();
  if (!result || result.length > maxLength) throw new ArchDraftInputError(errorMessage);
  return result;
}

function optionalTextField(value: FormDataEntryValue | null, maxLength: number): string {
  if (value === null) return '';
  if (typeof value !== 'string' || value.trim().length > maxLength) {
    throw new ArchDraftInputError('説明は500文字以内で入力してください。');
  }
  return value.trim();
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new ArchDraftInputError('リクエストの形式を読み取れません。');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ArchDraftInputError('リクエストの形式を確認してください。');
  }
  return value as Record<string, unknown>;
}

function safeFileStem(value: string): string {
  const stem = value.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').slice(0, 100);
  return stem || 'drawing';
}

function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function nowMilliseconds(): number {
  return Date.now();
}

function errorResponse(message: string, status: number): Response {
  return jsonResponse<AppEnv>({ error: message }, status);
}
