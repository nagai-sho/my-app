import { create } from "zustand";
import type { CollectionApi } from "./apiClient";
import { makeImageThumbnail } from "./image";
import { getPdfPageCount, makePdfThumbnail } from "./pdf";
import { baseName } from "./paths";
import type { Folder, StoredDocument } from "../types/document";

const maxFilesPerUpload = 50;
const maxFileBytes = 25 * 1024 * 1024;

type UploadStatus = {
  name: string;
  progress: number;
  message: string;
};

export type DocumentsState = {
  documents: StoredDocument[];
  folders: Folder[];
  loading: boolean;
  upload: UploadStatus | null;
  error: string | null;
  refresh: () => Promise<void>;
  uploadFiles: (files: FileList, folderPath: string) => Promise<void>;
  remove: (document: StoredDocument) => Promise<void>;
  removeMany: (documents: StoredDocument[]) => Promise<void>;
  addFolder: (path: string) => Promise<void>;
  renameFolderPath: (path: string, newPath: string) => Promise<void>;
  removeFolder: (path: string) => Promise<void>;
  moveMany: (documents: StoredDocument[], folderPath: string) => Promise<void>;
  reorder: (document: StoredDocument, direction: "up" | "down") => Promise<void>;
};

export function createDocumentsStore(api: CollectionApi) {
  return create<DocumentsState>((set, get) => ({
  documents: [],
  folders: [],
  loading: false,
  upload: null,
  error: null,
  async refresh() {
    set({ loading: true, error: null });
    try {
      const [documentResult, folderResult] = await Promise.all([api.listDocuments(), api.listFolders()]);
      if ("unauthorized" in documentResult || "unauthorized" in folderResult) {
        set({ documents: [], folders: [], loading: false });
        return;
      }
      const folderResultFolders = folderResult.folders;
      set({
        documents: sortDocuments(documentResult.documents, folderResultFolders),
        folders: [...folderResultFolders].sort(compareFolders),
        loading: false,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "一覧取得に失敗しました", loading: false });
    }
  },
  async uploadFiles(files, folderPath) {
    if (!folderPath.trim()) {
      set({ error: "アップロード先ディレクトリを選択してください", upload: null });
      return;
    }
    const selectedFiles = Array.from(files);
    if (selectedFiles.length > maxFilesPerUpload) {
      set({ error: `一度にアップロードできるのは${maxFilesPerUpload}件までです`, upload: null });
      return;
    }

    const failed: string[] = [];
    let nextSortOrder =
      Math.max(
        0,
        ...get()
          .documents.filter((document) => document.folder_path === folderPath)
          .map((document) => document.sort_order),
      ) + 1000;
    for (const [index, file] of selectedFiles.entries()) {
      let uploadedDocumentId: string | null = null;
      try {
        const isPdf = file.type === "application/pdf";
        const isImage = file.type.startsWith("image/");
        if (!isPdf && !isImage) {
          failed.push(`${file.name}（非対応形式）`);
          set({ error: `${file.name} は対応していない形式です` });
          continue;
        }
        if (file.size > maxFileBytes) {
          failed.push(`${file.name}（25MB超過）`);
          set({ error: `${file.name} は25MBを超えています` });
          continue;
        }

        set({
          upload: {
            name: file.name,
            progress: Math.round((index / selectedFiles.length) * 100),
            message: `${index + 1}/${selectedFiles.length} 原本をR2に保存中`,
          },
          error: null,
        });
        uploadedDocumentId = crypto.randomUUID();
        await api.uploadObject(file, uploadedDocumentId, "original", file.name);

        set({
          upload: {
            name: file.name,
            progress: Math.round(((index + 0.35) / selectedFiles.length) * 100),
            message: `${index + 1}/${selectedFiles.length} サムネイルを生成中`,
          },
        });
        const thumbBlob = isPdf ? await makePdfThumbnail(file) : await makeImageThumbnail(file);
        await api.uploadObject(thumbBlob, uploadedDocumentId, "thumbnail", `${file.name}.thumb.jpg`);

        set({
          upload: {
            name: file.name,
            progress: Math.round(((index + 0.7) / selectedFiles.length) * 100),
            message: `${index + 1}/${selectedFiles.length} メタデータを保存中`,
          },
        });
        const pageCount = isPdf ? await getPdfPageCount(file) : 1;
        const sourceCreatedAt = new Date(file.lastModified || Date.now()).toISOString();
        const sortOrder = nextSortOrder;
        nextSortOrder += 1000;
        const { document } = await api.createDocument({
          id: uploadedDocumentId,
          title: file.name,
          kind: isPdf ? "pdf" : "image",
          folder_path: folderPath,
          page_count: pageCount,
          bytes: file.size,
          mime: file.type || "application/octet-stream",
          source_created_at: sourceCreatedAt,
          sort_order: sortOrder,
        });
        uploadedDocumentId = null;
        set({
          documents: sortDocuments([...get().documents, document], get().folders),
          upload: { name: file.name, progress: 100, message: "完了" },
        });
      } catch (error) {
        if (uploadedDocumentId) {
          await api.cleanupUploadedFiles(uploadedDocumentId).catch(() => undefined);
        }
        failed.push(file.name);
        set({
          error: `${file.name}: ${error instanceof Error ? error.message : "アップロードに失敗しました"}`,
          upload: null,
        });
      }
    }
    await get().refresh();
    if (failed.length > 0) {
      set({ error: `${failed.length}件のアップロードに失敗しました: ${failed.join(", ")}` });
    }
    window.setTimeout(() => set({ upload: null }), 700);
  },
  async remove(document) {
    await api.deleteDocument(document.id);
    set({ documents: get().documents.filter((item) => item.id !== document.id) });
  },
  async removeMany(documents) {
    set({ error: null });
    const failed: string[] = [];
    for (const document of documents) {
      try {
        await api.deleteDocument(document.id);
      } catch {
        failed.push(document.title);
      }
    }
    const failedIds = new Set(failed.length > 0 ? [] : documents.map((document) => document.id));
    if (failed.length === 0) {
      set({ documents: get().documents.filter((item) => !failedIds.has(item.id)) });
      return;
    }
    await get().refresh();
    set({ error: `${failed.length}件の削除に失敗しました: ${failed.join(", ")}` });
  },
  async addFolder(path) {
    set({ error: null });
    await api.createFolder(path);
    await get().refresh();
  },
  async renameFolderPath(path, newPath) {
    set({ error: null });
    await api.renameFolder(path, newPath);
    await get().refresh();
  },
  async removeFolder(path) {
    set({ error: null });
    await api.deleteFolder(path);
    await get().refresh();
  },
  async moveMany(documents, folderPath) {
    set({ error: null });
    if (!folderPath.trim()) {
      set({ error: "移動先ディレクトリを選択してください" });
      return;
    }
    const result = await api.moveDocuments(
      documents.map((document) => document.id),
      folderPath,
    );
    const moved = new Set(result.moved);
    set({
      documents: get().documents.map((document) =>
        moved.has(document.id) ? { ...document, folder_path: folderPath } : document,
      ),
    });
    await get().refresh();
  },
  async reorder(document, direction) {
    set({ error: null });
    const currentFolders = get().folders;
    const siblings = get()
      .documents.filter((item) => item.folder_path === document.folder_path)
      .sort((left, right) => compareDocuments(left, right, currentFolders));
    const index = siblings.findIndex((item) => item.id === document.id);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= siblings.length) return;

    const reordered = [...siblings];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    const orderById = new Map(reordered.map((item, itemIndex) => [item.id, (itemIndex + 1) * 1000]));

    await Promise.all(
      reordered
        .filter((item) => item.sort_order !== orderById.get(item.id))
        .map((item) => api.updateDocumentOrder(item.id, orderById.get(item.id) ?? item.sort_order)),
    );

    const folders = get().folders.map((folder) =>
      folder.path === document.folder_path ? { ...folder, manual_order_enabled: 1 } : folder,
    );

    set({
      folders,
      documents: get()
        .documents.map((item) => {
          const sortOrder = orderById.get(item.id);
          if (sortOrder !== undefined) return { ...item, sort_order: sortOrder };
          return item;
        })
        .sort((left, right) => compareDocuments(left, right, folders)),
    });
  },
  }));
}

function sortDocuments(documents: StoredDocument[], folders: Folder[]) {
  return [...documents].sort((left, right) => compareDocuments(left, right, folders));
}

function compareDocuments(left: StoredDocument, right: StoredDocument, folders: Folder[]) {
  const folderComparison = left.folder_path.localeCompare(right.folder_path);
  if (folderComparison !== 0) return folderComparison;
  if (folders.some((folder) => folder.path === left.folder_path && folder.manual_order_enabled === 1)) {
    return compareDocumentsByOrder(left, right);
  }
  return compareDocumentsByName(left, right);
}

function compareDocumentsByName(left: StoredDocument, right: StoredDocument) {
  return (
    left.title.localeCompare(right.title, "ja-JP", { numeric: true, sensitivity: "base" }) ||
    compareDocumentsByOrder(left, right)
  );
}

function compareDocumentsByOrder(left: StoredDocument, right: StoredDocument) {
  return (
    left.sort_order - right.sort_order ||
    left.source_created_at.localeCompare(right.source_created_at) ||
    left.created_at.localeCompare(right.created_at) ||
    left.title.localeCompare(right.title, "ja-JP", { numeric: true, sensitivity: "base" })
  );
}

function compareFolders(left: Folder, right: Folder) {
  return (
    baseName(left.path).localeCompare(baseName(right.path), "ja-JP", { numeric: true, sensitivity: "base" }) ||
    left.path.localeCompare(right.path, "ja-JP", { numeric: true, sensitivity: "base" })
  );
}
