import { useEffect, useRef, useState, useMemo } from 'react';
import { transformXmlToItaxSheets, type ItaxSheetResult } from '../core/itaxEngine';
import { ITAX_SCOPED_CSS } from '../core/mauItaxBctc';

export interface ItaxViewerProps {
  xml: string;
  tenFile?: string;
  onClose?: () => void;
}

export function ItaxViewer({ xml, tenFile, onClose }: ItaxViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);

  const [activeTab, setActiveTab] = useState<string>('all'); // 'all' hoặc id của sheet

  // Biến đổi XML sang các sheets
  const sheets: ItaxSheetResult[] | null = useMemo(() => {
    return transformXmlToItaxSheets(xml);
  }, [xml]);

  // Thiết lập Shadow DOM một lần
  useEffect(() => {
    if (!containerRef.current) return;
    if (!shadowRootRef.current) {
      shadowRootRef.current = containerRef.current.attachShadow({ mode: 'open' });
    }
  }, []);

  // Cập nhật nội dung hiển thị trong Shadow DOM khi sheets hoặc activeTab thay đổi
  useEffect(() => {
    const root = shadowRootRef.current;
    if (!root) return;

    if (!sheets || sheets.length === 0) {
      root.innerHTML = `
        <div style="padding: 40px; text-align: center; color: #64748b; font-family: sans-serif;">
          <p style="font-size: 16px; font-weight: bold;">Không có dữ liệu hiển thị theo mẫu iTax Viewer</p>
          <p style="font-size: 13px;">File XML có thể không thuộc danh mục mẫu HTKK hỗ trợ hoặc cấu trúc bị lỗi.</p>
        </div>
      `;
      return;
    }

    const filteredSheets = activeTab === 'all'
      ? sheets
      : sheets.filter(s => s.id === activeTab);

    // CSS cô lập trong Shadow DOM
    const printStyle = `
      <style>
        :host {
          display: block;
          background: #f1f5f9;
          min-height: 100%;
          padding: 16px 0;
          box-sizing: border-box;
        }
        .itax-wrap {
          overflow-x: auto;
          padding: 0 16px 16px;
        }
        .itax-sheet {
          display: flow-root;
          width: 920px;
          margin: 0 auto 24px;
          background: #fff;
          padding: 30px 40px 24px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
          color: #000;
          font-family: "Times New Roman", Times, serif;
          font-size: 12pt;
          line-height: 1.35;
          box-sizing: border-box;
          border-radius: 2px;
        }
        .itax-sheet * {
          box-sizing: content-box;
        }
        .itax-sheet.ngang {
          width: 1262px;
        }
        .itax-sheet table {
          border-collapse: collapse;
          width: 100%;
        }
        .itax-sig-foot {
          clear: both;
          margin-top: 16px;
        }
        @media print {
          :host {
            background: #fff !important;
            padding: 0 !important;
          }
          .itax-wrap {
            overflow: visible !important;
            padding: 0 !important;
          }
          .itax-sheet, .itax-sheet.ngang {
            width: 100% !important;
            max-width: none !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border-radius: 0 !important;
          }
          .itax-sheet + .itax-sheet {
            page-break-before: always;
          }
          tr {
            page-break-inside: avoid;
          }
        }
        ${ITAX_SCOPED_CSS}
      </style>
    `;

    const sheetsHtml = filteredSheets.map((s) => {
      const isNgang = s.orient === '1';
      return `
        <div class="itax-sheet ${isNgang ? 'ngang' : ''}">
          ${s.html}
        </div>
      `;
    }).join('\n');

    root.innerHTML = `
      ${printStyle}
      <div class="itax-wrap">
        ${sheetsHtml}
      </div>
    `;
  }, [sheets, activeTab]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadXml = () => {
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = tenFile || 'BaoCaoTaiChinh.xml';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-slate-100 rounded-lg overflow-hidden border border-slate-300 shadow-sm print:m-0 print:border-none print:shadow-none print:bg-white">
      {/* Thanh công cụ / Tabs (Ẩn khi in ấn) */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-red-700 font-bold text-base flex items-center gap-1.5 shrink-0">
            📑 Bản in chuẩn iTax / HTKK
          </span>
          {tenFile && (
            <span className="text-xs text-slate-500 truncate max-w-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-200" title={tenFile}>
              {tenFile}
            </span>
          )}
        </div>

        {/* Các nút hành động */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadXml}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded flex items-center gap-1 transition-colors cursor-pointer"
            title="Tải tệp XML về máy"
          >
            📥 Tải XML
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="In hoặc lưu file PDF (chuẩn khổ A4)"
          >
            🖨️ In / Lưu PDF
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
              title="Đóng bản in"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Tabs chọn từng biểu mẫu (Ẩn khi in ấn) */}
      {sheets && sheets.length > 1 && (
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-1.5 flex flex-wrap items-center gap-1.5 print:hidden">
          <span className="text-xs text-slate-500 font-medium mr-1">Biểu mẫu:</span>
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-2.5 py-1 text-xs rounded font-medium transition-colors cursor-pointer ${
              activeTab === 'all'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
            }`}
          >
            Tất cả các biểu ({sheets.length})
          </button>
          {sheets.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveTab(s.id)}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors cursor-pointer ${
                activeTab === s.id
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Vùng hiển thị tài liệu bọc Shadow DOM */}
      <div className="flex-1 overflow-auto bg-slate-200 print:overflow-visible print:bg-white print:p-0">
        <div ref={containerRef} className="w-full min-h-full" />
      </div>
    </div>
  );
}
