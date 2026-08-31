import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { useDocuments } from "../hooks/useDocuments";
import { useFileObjectUrl } from "../hooks/useFileObjectUrl";
import { useCollectionApi } from "../lib/useCollectionApi";
import { blobUrl } from "../lib/image";
import { renderPdfPage } from "../lib/pdf";

export function Viewer() {
  const { id } = useParams();
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const folderScope = searchParams.get("folder");
  const api = useCollectionApi();
  const { documents, refresh } = useDocuments();
  const document = useMemo(() => documents.find((item) => item.id === id), [documents, id]);
  const backTo = folderScope ? `/collection/books/detail?path=${encodeURIComponent(folderScope)}` : "/collection";
  const imageDocuments = useMemo(
    () =>
      documents.filter(
        (item) => item.kind === "image" && (folderScope === null || item.folder_path === folderScope),
      ),
    [documents, folderScope],
  );
  const imageIndex = useMemo(
    () => (document?.kind === "image" ? imageDocuments.findIndex((item) => item.id === document.id) : -1),
    [document, imageDocuments],
  );
  const imageUrl = useFileObjectUrl(document?.id, "original", document?.kind === "image");
  const [pdfCanvasUrl, setPdfCanvasUrl] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (documents.length === 0) void refresh();
  }, [documents.length, refresh]);

  useEffect(() => {
    setError(null);
    setPdfCanvasUrl(null);
    setPage(1);
  }, [document?.id, document?.kind]);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    if (!document || document.kind !== "pdf") return undefined;
    void api.fetchObject(document.id, "original")
      .then(async (blob) => {
        const canvas = await renderPdfPage(blob, page, 1.6);
        const canvasBlob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("PDF描画に失敗しました"))), "image/png");
        });
        url = blobUrl(canvasBlob);
        if (!cancelled) setPdfCanvasUrl(url);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "ファイルを開けませんでした");
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [api, document, page]);

  useEffect(() => {
    if (!document || document.kind !== "pdf") return;
    setPage((current) => Math.min(Math.max(1, current), document.page_count || 1));
  }, [document]);

  const navigateToImage = useCallback((targetIndex: number) => {
    const target = imageDocuments[targetIndex];
    if (!target) return;
    navigate({
      pathname: `/collection/viewer/${target.id}`,
      search: folderScope === null ? "" : `?folder=${encodeURIComponent(folderScope)}`,
    });
  }, [folderScope, imageDocuments, navigate]);

  const goPrev = useCallback(() => {
    if (!document) return;
    if (document.kind === "image") navigateToImage(imageIndex - 1);
    else setPage((current) => Math.max(1, current - 1));
  }, [document, imageIndex, navigateToImage]);

  const goNext = useCallback(() => {
    if (!document) return;
    if (document.kind === "image") navigateToImage(imageIndex + 1);
    else setPage((current) => Math.min(document.page_count || 1, current + 1));
  }, [document, imageIndex, navigateToImage]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") goPrev();
      if (event.key === "ArrowRight") goNext();
      if (event.key === "Escape") window.history.back();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  if (!document) {
    return (
      <main className="viewer">
        <Link to={backTo} className="back-link">
          <ArrowLeft size={20} /> 戻る
        </Link>
        <p className="muted">ファイルを読み込み中</p>
      </main>
    );
  }

  const maxPage = document.kind === "image" ? imageDocuments.length || 1 : document.page_count || 1;
  const currentPage = document.kind === "image" ? imageIndex + 1 || 1 : page;
  const canPrev = document.kind === "image" ? imageIndex > 0 : page > 1;
  const canNext = document.kind === "image" ? imageIndex >= 0 && imageIndex < imageDocuments.length - 1 : page < maxPage;
  const source = document.kind === "pdf" ? pdfCanvasUrl : imageUrl;

  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    if (event.touches.length !== 1) {
      touchStartRef.current = null;
      return;
    }
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || event.changedTouches.length !== 1) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const elapsed = Date.now() - start.time;
    const horizontal = Math.abs(deltaX);
    const vertical = Math.abs(deltaY);

    if (elapsed > 700 || horizontal < 52 || horizontal < vertical * 1.4) return;
    if (deltaX < 0 && canNext) goNext();
    if (deltaX > 0 && canPrev) goPrev();
  };

  return (
    <main className="viewer">
      <header className="viewer-header">
        <Link to={backTo} className="back-link">
          <ArrowLeft size={20} /> 戻る
        </Link>
        <strong>{document.title}</strong>
        <span>{currentPage}/{maxPage}</span>
      </header>
      {error ? <p className="alert">{error}</p> : null}
      <section className="canvas-stage" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {source ? (
          <TransformWrapper key={`${document.id}-${currentPage}`} doubleClick={{ mode: "toggle" }} minScale={0.75} maxScale={5} centerOnInit>
            <TransformComponent wrapperClass="transform-wrapper" contentClass="transform-content">
              <img className="viewer-image" src={source} alt={document.title} />
            </TransformComponent>
          </TransformWrapper>
        ) : (
          <p className="muted">描画中</p>
        )}
      </section>
      <div className="pager">
        <button type="button" className="round-button" disabled={!canPrev} onClick={goPrev} aria-label="前へ">
          <ChevronLeft size={24} />
        </button>
        <button type="button" className="round-button" disabled={!canNext} onClick={goNext} aria-label="次へ">
          <ChevronRight size={24} />
        </button>
      </div>
    </main>
  );
}
