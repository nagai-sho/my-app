import { useMemo, useState, type DragEvent, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  House,
  Layers,
  LayoutTemplate,
  LoaderCircle,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  archDraftApi,
  formatArchDraftBytes,
  formatArchDraftDate,
  type ArchDraftDrawingDetail,
  type ArchDraftDrawingSummary,
  type ArchDraftJob,
  type ArchDraftTemplate,
  type TemplateVariable,
} from './apiClient';
import styles from './ArchDraftApp.module.css';

interface ArchDraftAppProps {
  onLogout: () => void;
}

type Dialog = 'template' | 'create' | 'upload' | null;

const ALLOWED_EXTENSIONS = ['jww', 'jwc'];

// TODO: Add drawing-level owner/editor/viewer controls when my-app introduces app-specific permissions.
export function ArchDraftApp({ onLogout }: ArchDraftAppProps): JSX.Element {
  const queryClient = useQueryClient();
  const templatesQuery = useQuery({
    queryKey: ['arch-draft-app', 'templates'],
    queryFn: archDraftApi.listTemplates,
  });
  const drawingsQuery = useQuery({
    queryKey: ['arch-draft-app', 'drawings'],
    queryFn: archDraftApi.listDrawings,
    refetchInterval: (query) => query.state.data?.drawings.some(
      (drawing) => drawing.latestJobStatus === 'pending' || drawing.latestJobStatus === 'processing',
    ) ? 2500 : false,
  });

  const [dialog, setDialog] = useState<Dialog>(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [uploadTargetDrawingId, setUploadTargetDrawingId] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [drawingTitle, setDrawingTitle] = useState('');
  const [drawingFile, setDrawingFile] = useState<File | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});

  const templates = templatesQuery.data?.templates ?? [];
  const drawings = drawingsQuery.data?.drawings ?? [];
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? null;
  const filteredDrawings = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    if (!normalizedSearch) return drawings;
    return drawings.filter((drawing) =>
      `${drawing.title} ${drawing.templateName ?? ''}`.toLocaleLowerCase().includes(normalizedSearch),
    );
  }, [drawings, search]);

  const detailQuery = useQuery({
    queryKey: ['arch-draft-app', 'drawing', selectedDrawingId],
    queryFn: () => archDraftApi.drawing(selectedDrawingId ?? ''),
    enabled: Boolean(selectedDrawingId),
    refetchInterval: (query) => {
      const hasRunningJobs = query.state.data?.drawing.versions.some((version) =>
        version.jobs.some((job) => job.status === 'pending' || job.status === 'processing'),
      );
      return hasRunningJobs ? 2000 : false;
    },
  });

  const refreshAppData = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['arch-draft-app', 'templates'] }),
      queryClient.invalidateQueries({ queryKey: ['arch-draft-app', 'drawings'] }),
      queryClient.invalidateQueries({ queryKey: ['arch-draft-app', 'drawing'] }),
    ]);
  };

  const templateMutation = useMutation({
    mutationFn: () => {
      if (!templateFile) throw new Error('テンプレートファイルを選択してください。');
      return archDraftApi.createTemplate({
        name: templateName.trim(),
        description: templateDescription.trim(),
        file: templateFile,
      });
    },
    onSuccess: async () => {
      setNotice('テンプレートを登録しました。');
      setDialog(null);
      setTemplateName('');
      setTemplateDescription('');
      setTemplateFile(null);
      await refreshAppData();
    },
    onError: (error: unknown) => setNotice(errorMessage(error, 'テンプレートを登録できませんでした。')),
  });

  const createDrawingMutation = useMutation({
    mutationFn: () => {
      if (!selectedTemplate) throw new Error('テンプレートを選択してください。');
      return archDraftApi.createFromTemplate({
        templateId: selectedTemplate.id,
        title: drawingTitle.trim(),
        variables: variableValues,
      });
    },
    onSuccess: async ({ drawing }) => {
      setNotice('テンプレートから図面を作成しました。');
      setDialog(null);
      setSelectedDrawingId(drawing.id);
      setDrawingTitle('');
      setVariableValues({});
      await refreshAppData();
    },
    onError: (error: unknown) => setNotice(errorMessage(error, '図面を作成できませんでした。')),
  });

  const uploadDrawingMutation = useMutation({
    mutationFn: () => {
      if (!drawingFile) throw new Error('図面ファイルを選択してください。');
      return archDraftApi.uploadDrawing({
        file: drawingFile,
        title: drawingTitle.trim(),
        ...(uploadTargetDrawingId ? { drawingId: uploadTargetDrawingId } : {}),
      });
    },
    onSuccess: async ({ drawing }) => {
      setNotice(uploadTargetDrawingId ? '図面の新しい版を追加しました。' : '図面を保管しました。');
      setDialog(null);
      setSelectedDrawingId(drawing.id);
      setDrawingTitle('');
      setDrawingFile(null);
      setUploadTargetDrawingId(undefined);
      await refreshAppData();
    },
    onError: (error: unknown) => setNotice(errorMessage(error, '図面をアップロードできませんでした。')),
  });

  const conversionMutation = useMutation({
    mutationFn: (versionId: string) => archDraftApi.createConversion(versionId),
    onSuccess: async () => {
      setNotice('DXFのモックファイルを作成しました。形状は変換されていません。');
      await refreshAppData();
    },
    onError: (error: unknown) => setNotice(errorMessage(error, '変換ジョブを作成できませんでした。')),
  });

  function openTemplateDialog(): void {
    setNotice(null);
    setTemplateName('');
    setTemplateDescription('');
    setTemplateFile(null);
    setDialog('template');
  }

  function openCreateDialog(template: ArchDraftTemplate): void {
    setNotice(null);
    setSelectedTemplateId(template.id);
    setDrawingTitle('');
    setVariableValues(Object.fromEntries(template.variables.map((variable) => [variable.key, variable.default])));
    setDialog('create');
  }

  function openUploadDialog(drawingId?: string, title?: string): void {
    setNotice(null);
    setUploadTargetDrawingId(drawingId);
    setDrawingTitle(title ?? '');
    setDrawingFile(null);
    setDialog('upload');
  }

  function closeDialog(): void {
    setDialog(null);
    setUploadTargetDrawingId(undefined);
  }

  function acceptDrawingFile(file: File | null): void {
    if (!file) return;
    if (!hasAllowedExtension(file.name)) {
      setNotice('図面は .jww または .jwc ファイルを選択してください。');
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setNotice('ファイルは100MB以下にしてください。');
      return;
    }
    setNotice(null);
    setDrawingFile(file);
    setDrawingTitle((current) => current || file.name.replace(/\.[^.]+$/, ''));
  }

  function acceptTemplateFile(file: File | null): void {
    if (!file) return;
    if (!hasAllowedExtension(file.name)) {
      setNotice('テンプレートは .jww または .jwc ファイルを選択してください。');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setNotice('テンプレートは2MB以下にしてください。');
      return;
    }
    setNotice(null);
    setTemplateFile(file);
    setTemplateName((current) => current || file.name.replace(/\.[^.]+$/, ''));
  }

  function submitTemplate(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setNotice(null);
    templateMutation.mutate();
  }

  function submitCreateDrawing(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setNotice(null);
    createDrawingMutation.mutate();
  }

  function submitUpload(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setNotice(null);
    uploadDrawingMutation.mutate();
  }

  const detail = detailQuery.data?.drawing;
  const activeJobs = drawings.filter((drawing) => drawing.latestJobStatus === 'processing' || drawing.latestJobStatus === 'pending').length;
  const loadError = templatesQuery.error || drawingsQuery.error;

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <Link className={styles.homeButton} to="/" aria-label="アプリ一覧へ戻る"><House size={18} /></Link>
            <div className={styles.brandMark} aria-hidden="true"><Layers size={18} /></div>
            <div>
              <p className={styles.kicker}>ARCH DRAFT STUDIO</p>
              <h1>図面ドラフト</h1>
            </div>
          </div>
          <div className={styles.headerActions}>
            <span className={styles.accessPill}><span /> my-app workspace</span>
            <button className={styles.headerButton} type="button" title="ログアウト" aria-label="ログアウト" onClick={onLogout}>
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.heroEyebrow}><span className={styles.sparkIcon}><Sparkles size={13} /></span> 図面作成ワークスペース</div>
            <h2>図面づくりを、<br /><span>ひとつ先へ。</span></h2>
            <p>テンプレートから始めて、版を重ねて管理。必要な図面を、いつでも見つけられる場所に。</p>
            <div className={styles.heroActions}>
              <button
                className={styles.primaryButton}
                type="button"
                onClick={() => templates.length > 0 ? openCreateDialog(templates[0]) : openTemplateDialog()}
              >
                <Plus size={17} /> {templates.length > 0 ? 'テンプレートから作成' : 'テンプレートを登録'}
              </button>
              <button className={styles.secondaryButton} type="button" onClick={() => openUploadDialog()}>
                <Upload size={17} /> 図面をアップロード
              </button>
            </div>
            <div className={styles.heroFootnote}><span className={styles.onlineDot} /> 個人ワークスペース <span className={styles.footnoteDivider}>·</span> UTF-8 JWテンプレート対応</div>
          </div>
          <div className={styles.heroArt} aria-hidden="true">
            <div className={styles.artGlow} />
            <div className={styles.blueprint}>
              <div className={styles.blueprintTop}><span>PROJECT / A-102</span><span>1 : 100</span></div>
              <div className={styles.planGrid}>
                <div className={styles.planOuter}>
                  <span className={styles.planDoor} />
                  <span className={styles.planWindow} />
                  <span className={styles.planInnerA} />
                  <span className={styles.planInnerB} />
                  <span className={styles.planInnerC} />
                </div>
                <div className={styles.measure measureTop}><i /> 6,000 <i /></div>
                <div className={styles.measure measureSide}><i /> 4,500 <i /></div>
              </div>
              <div className={styles.blueprintBottom}><span>FLOOR PLAN</span><span className={styles.scaleBar} /></div>
            </div>
            <div className={styles.floatingNote}><span><CheckCircle2 size={15} /></span><div><strong>Version 03</strong><small>保存しました</small></div></div>
            <div className={styles.artSparkle}><Sparkles size={17} /></div>
          </div>
        </section>

        <section className={styles.metrics} aria-label="図面ライブラリの概要">
          <Metric icon={<FileText size={17} />} label="保存した図面" value={drawings.length} suffix="件" tone="blue" />
          <Metric icon={<LayoutTemplate size={17} />} label="テンプレート" value={templates.length} suffix="件" tone="mint" />
          <Metric icon={<Clock3 size={17} />} label="変換中" value={activeJobs} suffix="件" tone="amber" />
          <div className={styles.metricNote}><span className={styles.metricNoteIcon}><Sparkles size={15} /></span><span>少ない手順で、<strong>今日の図面づくりを。</strong></span></div>
        </section>

        {notice && (
          <div className={styles.notice} role="status">
            <span><AlertCircle size={17} /></span>
            <p>{notice}</p>
            <button type="button" aria-label="メッセージを閉じる" onClick={() => setNotice(null)}><X size={17} /></button>
          </div>
        )}

        {loadError && (
          <div className={styles.errorBanner} role="alert">
            <AlertCircle size={18} />
            <span>{errorMessage(loadError, 'データの読み込みに失敗しました。')}</span>
            <button type="button" onClick={() => { void templatesQuery.refetch(); void drawingsQuery.refetch(); }}>
              <RefreshCw size={15} /> 再読み込み
            </button>
          </div>
        )}

        <div className={styles.contentGrid}>
          <section className={styles.panel} aria-labelledby="drawings-heading">
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.sectionKicker}>RECENT WORK</p>
                <h2 id="drawings-heading">最近の図面 <span className={styles.headingCount}>{drawings.length}</span></h2>
              </div>
              <button className={styles.iconButton} type="button" aria-label="図面一覧を更新" title="更新" onClick={() => void drawingsQuery.refetch()} disabled={drawingsQuery.isFetching}>
                <RefreshCw size={16} className={drawingsQuery.isFetching ? styles.spinning : undefined} />
              </button>
            </div>
            <label className={styles.searchBox}>
              <Search size={17} />
              <input value={search} onChange={(event) => setSearch(event.currentTarget.value)} placeholder="図面名・テンプレートで検索" aria-label="図面を検索" />
            </label>

            {drawingsQuery.isLoading ? (
              <div className={styles.loadingList} aria-label="図面を読み込み中">
                {[0, 1, 2].map((item) => <div className={styles.skeletonRow} key={item}><i /><span /><b /></div>)}
              </div>
            ) : filteredDrawings.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}><FileText size={23} /></div>
                <h3>{search ? '図面が見つかりません' : '図面はまだありません'}</h3>
                <p>{search ? '検索語を変えて、もう一度お試しください。' : 'テンプレートから作成するか、既存のJW図面を登録しましょう。'}</p>
                {!search && <button type="button" onClick={() => openUploadDialog()}><Upload size={15} /> 図面を登録</button>}
              </div>
            ) : (
              <div className={styles.drawingList}>
                {filteredDrawings.map((drawing, index) => (
                  <DrawingRow key={drawing.id} drawing={drawing} index={index} onClick={() => setSelectedDrawingId(drawing.id)} />
                ))}
              </div>
            )}
            {drawings.length > 0 && <div className={styles.listFooter}>最新の図面を最大100件表示しています<span><ArrowUpRight size={13} /></span></div>}
          </section>

          <section className={`${styles.panel} ${styles.templatePanel}`} aria-labelledby="templates-heading">
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.sectionKicker}>START FROM A TEMPLATE</p>
                <h2 id="templates-heading">テンプレート</h2>
              </div>
              <button className={styles.addTextButton} type="button" onClick={openTemplateDialog}><Plus size={15} /> 登録</button>
            </div>

            {templatesQuery.isLoading ? (
              <div className={styles.templateSkeletons}><i /><i /></div>
            ) : templates.length === 0 ? (
              <div className={styles.templateEmpty}>
                <div className={styles.templateEmptyIcon}><LayoutTemplate size={21} /></div>
                <h3>テンプレートを用意する</h3>
                <p>UTF-8のJWテキストに `${'{PROJECT_NAME}'}` などの変数を入れて登録します。</p>
                <button type="button" className={styles.templateUploadButton} onClick={openTemplateDialog}><Upload size={15} /> JWテンプレートを追加</button>
              </div>
            ) : (
              <div className={styles.templateList}>
                {templates.map((template, index) => (
                  <TemplateCard key={template.id} template={template} index={index} onClick={() => openCreateDialog(template)} />
                ))}
              </div>
            )}

            <div className={styles.templateTip}>
              <span><Sparkles size={14} /></span>
              <p>プレースホルダー <code>${'{VAR_NAME}'}</code> を登録時に入力値へ差し替えます。</p>
            </div>
          </section>
        </div>

        <footer className={styles.footer}><span>ARCH DRAFT STUDIO</span><span>my-app workspace <i /> internal</span></footer>
      </main>

      {selectedDrawingId && (
        <DrawingDrawer
          drawing={detail ?? findDrawingSummary(drawings, selectedDrawingId)}
          isLoading={detailQuery.isLoading}
          error={detailQuery.error}
          conversionPending={conversionMutation.isPending}
          onClose={() => setSelectedDrawingId(null)}
          onRefresh={() => void detailQuery.refetch()}
          onAddVersion={(drawing) => openUploadDialog(drawing.id, drawing.title)}
          onConvert={(versionId) => conversionMutation.mutate(versionId)}
        />
      )}

      {dialog && (
        <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
            <div className={styles.modalHeader}>
              <div className={styles.modalIcon}>{dialog === 'template' ? <LayoutTemplate size={19} /> : dialog === 'create' ? <Sparkles size={19} /> : <Upload size={19} />}</div>
              <div><p className={styles.sectionKicker}>{dialog === 'template' ? 'TEMPLATE LIBRARY' : dialog === 'create' ? 'NEW DRAWING' : 'FILE STORAGE'}</p><h2 id="dialog-title">{dialog === 'template' ? 'テンプレートを登録' : dialog === 'create' ? 'テンプレートから作成' : uploadTargetDrawingId ? '新しい版を追加' : '図面をアップロード'}</h2></div>
              <button className={styles.modalClose} type="button" aria-label="閉じる" onClick={closeDialog}><X size={18} /></button>
            </div>

            {dialog === 'template' && (
              <form className={styles.modalForm} onSubmit={submitTemplate}>
                <div className={styles.field}><label htmlFor="template-name">テンプレート名 <span>必須</span></label><input id="template-name" required maxLength={100} value={templateName} onChange={(event) => setTemplateName(event.currentTarget.value)} placeholder="例：平面図・標準" /></div>
                <div className={styles.field}><label htmlFor="template-description">説明 <small>任意</small></label><textarea id="template-description" rows={2} maxLength={500} value={templateDescription} onChange={(event) => setTemplateDescription(event.currentTarget.value)} placeholder="テンプレートの用途や補足" /></div>
                <FileDropZone label="JWテンプレート" hint=".jww / .jwc · UTF-8テキスト · 2MBまで" file={templateFile} accept=".jww,.jwc" onFile={acceptTemplateFile} />
                <div className={styles.modalInfo}><AlertCircle size={15} /><span>登録時に <code>${'{UPPER_CASE}'}</code> 形式の変数を自動で読み取ります。</span></div>
                <ModalActions onCancel={closeDialog} submitLabel="テンプレートを登録" isPending={templateMutation.isPending} disabled={!templateName.trim() || !templateFile} />
              </form>
            )}

            {dialog === 'create' && selectedTemplate && (
              <form className={styles.modalForm} onSubmit={submitCreateDrawing}>
                <div className={styles.selectedTemplate}><span><LayoutTemplate size={17} /></span><div><strong>{selectedTemplate.name}</strong><small>{selectedTemplate.fileName} · {selectedTemplate.variables.length}個の変数</small></div><button type="button" onClick={() => setDialog(null)}>変更</button></div>
                <div className={styles.field}><label htmlFor="drawing-title">図面名 <span>必須</span></label><input id="drawing-title" required maxLength={160} value={drawingTitle} onChange={(event) => setDrawingTitle(event.currentTarget.value)} placeholder="例：青山ビル 1階平面図" /></div>
                {selectedTemplate.variables.length === 0 ? (
                  <div className={styles.noVariables}><CheckCircle2 size={16} /> このテンプレートには置換する変数がありません。</div>
                ) : (
                  <div className={styles.variableFields}>
                    <p className={styles.fieldGroupLabel}>図面情報 <span>{selectedTemplate.variables.length}項目</span></p>
                    {selectedTemplate.variables.map((variable) => (
                      <VariableField key={variable.key} variable={variable} value={variableValues[variable.key] ?? ''} onChange={(value) => setVariableValues((current) => ({ ...current, [variable.key]: value }))} />
                    ))}
                  </div>
                )}
                <div className={styles.modalInfo}><Sparkles size={15} /><span>内容を差し替えて図面のv1を作成します。</span></div>
                <ModalActions onCancel={closeDialog} submitLabel="図面を作成" isPending={createDrawingMutation.isPending} disabled={!drawingTitle.trim() || selectedTemplate.variables.some((variable) => variable.required && !variableValues[variable.key]?.trim())} />
              </form>
            )}

            {dialog === 'upload' && (
              <form className={styles.modalForm} onSubmit={submitUpload}>
                <div className={styles.field}><label htmlFor="upload-title">図面名 <span>必須</span></label><input id="upload-title" required maxLength={160} value={drawingTitle} onChange={(event) => setDrawingTitle(event.currentTarget.value)} placeholder="例：青山ビル 1階平面図" /></div>
                <FileDropZone label="JW図面ファイル" hint=".jww / .jwc · 100MBまで" file={drawingFile} accept=".jww,.jwc" onFile={acceptDrawingFile} />
                {uploadTargetDrawingId && <div className={styles.modalInfo}><Layers size={15} /><span>既存図面に新しいバージョンとして追加します。</span></div>}
                <ModalActions onCancel={closeDialog} submitLabel={uploadTargetDrawingId ? '新しい版を追加' : '図面を保存'} isPending={uploadDrawingMutation.isPending} disabled={!drawingTitle.trim() || !drawingFile} />
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Metric({ icon, label, value, suffix, tone }: { icon: JSX.Element; label: string; value: number; suffix: string; tone: 'blue' | 'mint' | 'amber' }): JSX.Element {
  return <div className={styles.metric}><div className={`${styles.metricIcon} ${styles[tone]}`}>{icon}</div><div><span>{label}</span><strong>{value}<small>{suffix}</small></strong></div></div>;
}

function DrawingRow({ drawing, index, onClick }: { drawing: ArchDraftDrawingSummary; index: number; onClick: () => void }): JSX.Element {
  const iconClass = index % 3 === 0 ? styles.fileIconBlue : index % 3 === 1 ? styles.fileIconMint : styles.fileIconAmber;
  const state = drawing.latestJobStatus;
  return (
    <button type="button" className={styles.drawingRow} onClick={onClick}>
      <span className={`${styles.fileIcon} ${iconClass}`}><FileText size={18} /><i>{drawing.latestFileName?.split('.').pop()?.toUpperCase() || 'JW'}</i></span>
      <span className={styles.drawingInfo}>
        <span className={styles.drawingTitle}>{drawing.title}<ChevronRight size={15} /></span>
        <span className={styles.drawingMeta}>{drawing.templateName || 'アップロード'} <i /> {formatArchDraftDate(drawing.updatedAt)}</span>
      </span>
      <span className={styles.rowEnd}>
        {drawing.latestVersion && <span className={styles.versionBadge}>v{drawing.latestVersion}</span>}
        {state === 'processing' || state === 'pending' ? <span className={`${styles.jobBadge} ${styles.jobProgress}`}><i /> 変換中</span> : state === 'succeeded' ? <span className={`${styles.jobBadge} ${styles.jobComplete}`}><CheckCircle2 size={12} /> DXF</span> : <span className={styles.versionCount}>{drawing.versionCount}版</span>}
      </span>
    </button>
  );
}

function TemplateCard({ template, index, onClick }: { template: ArchDraftTemplate; index: number; onClick: () => void }): JSX.Element {
  return (
    <button type="button" className={styles.templateCard} onClick={onClick}>
      <span className={`${styles.templateArtwork} ${index % 2 ? styles.artworkMint : ''}`}>
        <span className={styles.artworkPaper}><i /><i /><i /><b /><i /><i /></span>
        <span className={styles.artworkLabel}><LayoutTemplate size={13} /> JW TEMPLATE</span>
      </span>
      <span className={styles.templateCardInfo}><strong>{template.name}</strong><small>{template.description || template.fileName}</small><em>{template.variables.length}個の変数 <span>·</span> <span>{formatArchDraftDate(template.updatedAt)}</span></em></span>
      <span className={styles.templateCardArrow}><ArrowUpRight size={16} /></span>
    </button>
  );
}

function DrawingDrawer({
  drawing,
  isLoading,
  error,
  conversionPending,
  onClose,
  onRefresh,
  onAddVersion,
  onConvert,
}: {
  drawing: ArchDraftDrawingDetail | ArchDraftDrawingSummary | null;
  isLoading: boolean;
  error: unknown;
  conversionPending: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onAddVersion: (drawing: ArchDraftDrawingSummary) => void;
  onConvert: (versionId: string) => void;
}): JSX.Element {
  return (
    <div className={styles.drawerBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className={styles.drawer} aria-label="図面の詳細">
        <div className={styles.drawerHeader}>
          <div><p className={styles.sectionKicker}>DRAWING DETAILS</p><div className={styles.drawerTitle}>{drawing?.title || '図面の詳細'}</div></div>
          <div className={styles.drawerActions}>
            <button className={styles.iconButton} type="button" title="更新" aria-label="詳細を更新" onClick={onRefresh}><RefreshCw size={16} /></button>
            <button className={styles.iconButton} type="button" title="閉じる" aria-label="詳細を閉じる" onClick={onClose}><X size={17} /></button>
          </div>
        </div>
        <div className={styles.drawerBody}>
          {isLoading && <div className={styles.drawerLoading}><LoaderCircle size={22} className={styles.spinning} /> 図面情報を読み込んでいます…</div>}
          {Boolean(error) && <div className={styles.drawerError}><AlertCircle size={16} />{errorMessage(error, '図面の詳細を読み込めませんでした。')}</div>}
          {drawing && (
            <>
              <div className={styles.detailHero}>
                <span className={styles.detailHeroIcon}><FileText size={22} /></span>
                <div><span>{drawing.templateName || '図面ファイル'}</span><strong>{drawing.title}</strong></div>
              </div>
              <div className={styles.detailStats}><div><small>バージョン</small><strong>{drawing.versionCount} <i>件</i></strong></div><div><small>最終更新</small><strong>{formatArchDraftDate(drawing.updatedAt)}</strong></div><div><small>テンプレート</small><strong>{drawing.templateName || 'アップロード'}</strong></div></div>
              <div className={styles.versionHeader}><div><p className={styles.sectionKicker}>VERSION HISTORY</p><h3>バージョン履歴</h3></div><button type="button" onClick={() => onAddVersion(drawing)}><Plus size={15} /> 新しい版</button></div>
              {'versions' in drawing && drawing.versions.length > 0 ? (
                <div className={styles.versionList}>
                  {drawing.versions.map((version) => (
                    <article className={styles.versionCard} key={version.id}>
                      <div className={styles.versionCardHeader}><span className={styles.versionNo}>v{version.versionNo}</span><span className={styles.versionDate}>{formatArchDraftDate(version.createdAt)}</span>{version.versionNo === drawing.latestVersion && <span className={styles.latestBadge}>LATEST</span>}</div>
                      <a className={styles.sourceFile} href={version.sourceFile.downloadUrl}><span className={styles.sourceFileIcon}><FileText size={15} /></span><span><strong>{version.sourceFile.fileName}</strong><small>{formatArchDraftBytes(version.sourceFile.byteSize)} · 元図面</small></span><ArrowDownToLine size={16} /></a>
                      <button className={styles.convertButton} type="button" disabled={conversionPending} onClick={() => onConvert(version.id)}>
                        {conversionPending ? <LoaderCircle size={15} className={styles.spinning} /> : <RefreshCw size={15} />}
                        DXFへ変換 <span>モック</span>
                      </button>
                      {version.jobs.length > 0 && (
                        <div className={styles.jobsList}>
                          {version.jobs.map((job) => <JobRow key={job.id} job={job} />)}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              ) : !isLoading ? (
                <div className={styles.emptyVersions}><Layers size={19} /><span>バージョンがまだありません。</span></div>
              ) : null}
              <div className={styles.mockNotice}><AlertCircle size={16} /><p><strong>変換機能は準備中です。</strong><br />現在のDXFは形状を含まない確認用ファイルです。実変換APIの接続後に図形変換が利用できます。</p></div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function JobRow({ job }: { job: ArchDraftJob }): JSX.Element {
  if (job.status === 'succeeded' && job.downloadUrl) {
    return (
      <div className={styles.jobResult}>
        <span className={styles.jobResultIcon}><CheckCircle2 size={15} /></span>
        <span className={styles.jobResultText}><strong>{job.outputFileName ?? '変換ファイル.dxf'}</strong><small>DXF · モック出力</small></span>
        <a href={job.downloadUrl} aria-label="DXFファイルをダウンロード"><ArrowDownToLine size={16} /></a>
      </div>
    );
  }
  if (job.status === 'pending' || job.status === 'processing') {
    return <div className={styles.jobWorking}><LoaderCircle size={14} className={styles.spinning} /> DXFを準備しています</div>;
  }
  return <div className={styles.jobFailed}><AlertCircle size={14} /> {job.errorMessage || '変換できませんでした。'}</div>;
}

function VariableField({ variable, value, onChange }: { variable: TemplateVariable; value: string; onChange: (value: string) => void }): JSX.Element {
  return (
    <div className={styles.field}>
      <label htmlFor={`variable-${variable.key}`}>{variable.label}{variable.required && <span>必須</span>}<small className={styles.variableKey}>{variable.key}</small></label>
      <input id={`variable-${variable.key}`} required={variable.required} value={value} onChange={(event) => onChange(event.currentTarget.value)} placeholder={variable.default || `${variable.label}を入力`} />
    </div>
  );
}

function FileDropZone({ label, hint, file, accept, onFile }: { label: string; hint: string; file: File | null; accept: string; onFile: (file: File | null) => void }): JSX.Element {
  function handleDrop(event: DragEvent<HTMLLabelElement>): void {
    event.preventDefault();
    onFile(event.dataTransfer.files[0] ?? null);
  }

  return (
    <label className={`${styles.dropZone} ${file ? styles.dropZoneFilled : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
      <input type="file" accept={accept} onChange={(event) => { onFile(event.currentTarget.files?.[0] ?? null); event.currentTarget.value = ''; }} />
      <span className={styles.dropIcon}>{file ? <CheckCircle2 size={19} /> : <Upload size={19} />}</span>
      <span className={styles.dropContent}><strong>{file ? file.name : label}</strong><small>{file ? `${formatArchDraftBytes(file.size)} · ファイルを変更するにはクリック` : hint}</small></span>
      <span className={styles.browseButton}>{file ? '変更' : '選択'}</span>
    </label>
  );
}

function ModalActions({ onCancel, submitLabel, isPending, disabled }: { onCancel: () => void; submitLabel: string; isPending: boolean; disabled: boolean }): JSX.Element {
  return (
    <div className={styles.modalActions}>
      <button className={styles.modalCancel} type="button" onClick={onCancel} disabled={isPending}>キャンセル</button>
      <button className={styles.modalSubmit} type="submit" disabled={disabled || isPending}>
        {isPending ? <LoaderCircle size={16} className={styles.spinning} /> : <CheckCircle2 size={16} />}
        {isPending ? '処理中…' : submitLabel}
      </button>
    </div>
  );
}

function findDrawingSummary(drawings: ArchDraftDrawingSummary[], id: string): ArchDraftDrawingSummary | null {
  return drawings.find((drawing) => drawing.id === id) ?? null;
}

function hasAllowedExtension(fileName: string): boolean {
  const extension = fileName.split('.').pop()?.toLowerCase();
  return Boolean(extension && ALLOWED_EXTENSIONS.includes(extension));
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
