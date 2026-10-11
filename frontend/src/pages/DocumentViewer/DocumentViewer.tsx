import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Download, Paperclip } from "lucide-react";
import { useLedger } from "../../hooks/useLedger";
import { attachmentApi } from "../../api/attachmentApi";
import { toast } from "sonner";

export default function DocumentViewer() {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;
  const { activeCompanyId, downloadAttachment } = useLedger();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!transactionId || !activeCompanyId) return;
    
    let url: string | null = null;
    
    async function fetchDoc() {
      try {
        setLoading(true);
        const file = await attachmentApi.download(activeCompanyId, Number(transactionId));
        setMimeType(file.blob.type);
        url = URL.createObjectURL(file.blob);
        setBlobUrl(url);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load document");
        toast.error("Unable to load document");
      } finally {
        setLoading(false);
      }
    }
    
    void fetchDoc();
    
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [transactionId, activeCompanyId]);

  const isImage = mimeType?.startsWith("image/");

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      <header className="z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => from ? navigate(from) : navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Paperclip size={18} className="text-slate-400" />
              Document Viewer
            </h1>
            <p className="text-sm text-slate-500">Transaction #{transactionId}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void downloadAttachment(Number(transactionId)).catch((e) => toast.error(e instanceof Error ? e.message : "Failed to download"))}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <Download size={16} />
          Download Original
        </button>
      </header>

      <main className="flex-1 overflow-hidden bg-slate-100/50">
        {loading ? (
          <div className="flex h-full w-full items-center justify-center">
            <div className="flex items-center gap-3 text-slate-500">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600"></div>
              <p className="font-medium">Loading document securely...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex h-full w-full items-center justify-center">
            <div className="p-8 text-center text-rose-600">
              <p className="text-lg font-medium">Error loading attachment</p>
              <p className="mt-1 text-sm">{error}</p>
            </div>
          </div>
        ) : blobUrl ? (
          isImage ? (
            <div className="h-full w-full overflow-auto p-4 sm:p-8 flex items-center justify-center">
              <img 
                src={blobUrl} 
                alt="Attachment Preview" 
                className="max-w-full max-h-[calc(100vh-140px)] object-scale-down rounded-xl shadow-md border border-slate-200 bg-white"
              />
            </div>
          ) : (
            <div className="h-full w-full flex flex-col">
              <object
                data={`${blobUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
                type="application/pdf"
                className="h-full w-full flex-1 border-0"
                aria-label="Document Preview"
              >
                <iframe 
                  src={`${blobUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`} 
                  className="h-full w-full border-0 bg-slate-50" 
                  title="Document Preview" 
                />
              </object>
            </div>
          )
        ) : null}
      </main>
    </div>
  );
}
