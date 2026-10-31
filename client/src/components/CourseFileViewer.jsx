import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Space, Spin, Typography } from 'antd';
import { Document, Page, pdfjs } from 'react-pdf';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { init as initPptx } from 'pptx-preview';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const IMAGE = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp']);
const VIDEO = new Set(['mp4', 'webm', 'mov']);
const SHEET = new Set(['xls', 'xlsx', 'csv']);

export function fileExt(name) {
  const base = String(name || '').split(/[/\\]/).pop() || '';
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return '';
  return base.slice(dot + 1).toLowerCase();
}

export function canViewInBrowser(ext) {
  return ext === 'pdf' || ext === 'docx' || ext === 'pptx' || ext === 'txt' || IMAGE.has(ext) || VIDEO.has(ext) || SHEET.has(ext);
}

function PdfView({ blob }) {
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [failed, setFailed] = useState('');

  if (failed) return <Alert type="warning" showIcon message={failed} />;

  return (
    <div className="material-viewer">
      <Space style={{ marginBottom: 8 }}>
        <Button size="small" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
          Назад
        </Button>
        <Typography.Text>{pages ? `${page} / ${pages}` : 'PDF'}</Typography.Text>
        <Button size="small" disabled={!pages || page >= pages} onClick={() => setPage((current) => current + 1)}>
          Дальше
        </Button>
      </Space>
      <Document
        file={blob}
        onLoadSuccess={({ numPages }) => {
          setPages(numPages);
          setPage(1);
        }}
        onLoadError={() => setFailed('PDF не открылся в браузере. Файл можно скачать.')}
        loading={<Spin />}
      >
        <Page pageNumber={page} width={800} />
      </Document>
    </div>
  );
}

function DocxView({ blob }) {
  const [html, setHtml] = useState('');
  const [failed, setFailed] = useState('');

  useEffect(() => {
    let cancelled = false;
    blob
      .arrayBuffer()
      .then((buffer) => mammoth.convertToHtml({ arrayBuffer: buffer }))
      .then((result) => {
        if (!cancelled) setHtml(result.value || '<p>Пустой документ</p>');
      })
      .catch(() => {
        if (!cancelled) setFailed('Документ Word не открылся в браузере. Файл можно скачать.');
      });
    return () => {
      cancelled = true;
    };
  }, [blob]);

  if (failed) return <Alert type="warning" showIcon message={failed} />;
  if (!html) return <Spin />;
  return <div className="material-viewer material-doc" dangerouslySetInnerHTML={{ __html: html }} />;
}

function SheetView({ blob }) {
  const [book, setBook] = useState(null);
  const [sheet, setSheet] = useState('');
  const [failed, setFailed] = useState('');

  useEffect(() => {
    let cancelled = false;
    blob
      .arrayBuffer()
      .then((buffer) => {
        const workbook = XLSX.read(buffer, { type: 'array' });
        if (cancelled) return;
        setBook(workbook);
        setSheet(workbook.SheetNames[0] || '');
      })
      .catch(() => {
        if (!cancelled) setFailed('Таблица не открылась в браузере. Файл можно скачать.');
      });
    return () => {
      cancelled = true;
    };
  }, [blob]);

  if (failed) return <Alert type="warning" showIcon message={failed} />;
  if (!book || !sheet) return <Spin />;

  const rows = XLSX.utils.sheet_to_json(book.Sheets[sheet], { header: 1, raw: false, defval: '' });
  const width = Math.max(1, ...rows.map((row) => row.length));

  return (
    <div className="material-viewer">
      {book.SheetNames.length > 1 && (
        <Space wrap style={{ marginBottom: 8 }}>
          {book.SheetNames.map((name) => (
            <Button key={name} size="small" type={name === sheet ? 'primary' : 'default'} onClick={() => setSheet(name)}>
              {name}
            </Button>
          ))}
        </Space>
      )}
      <table>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {Array.from({ length: width }, (_, cell) => (
                <td key={cell}>{row[cell] ?? ''}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PptxView({ blob }) {
  const host = useRef(null);
  const [failed, setFailed] = useState('');

  useEffect(() => {
    const node = host.current;
    if (!node) return undefined;
    let cancelled = false;
    const previewer = initPptx(node, { width: 800, height: 450, mode: 'list' });
    blob
      .arrayBuffer()
      .then((buffer) => {
        if (!cancelled) return previewer.preview(buffer);
        return null;
      })
      .catch(() => {
        if (!cancelled) setFailed('Презентация не открылась в браузере. Файл можно скачать.');
      });
    return () => {
      cancelled = true;
      node.replaceChildren();
    };
  }, [blob]);

  return (
    <div>
      {failed && <Alert type="warning" showIcon message={failed} style={{ marginBottom: 8 }} />}
      <div ref={host} className="material-viewer" />
    </div>
  );
}

function TextView({ blob }) {
  const [text, setText] = useState(null);
  const [failed, setFailed] = useState('');

  useEffect(() => {
    let cancelled = false;
    blob
      .text()
      .then((value) => {
        if (!cancelled) setText(value);
      })
      .catch(() => {
        if (!cancelled) setFailed('Текст не открылся. Файл можно скачать.');
      });
    return () => {
      cancelled = true;
    };
  }, [blob]);

  if (failed) return <Alert type="warning" showIcon message={failed} />;
  if (text == null) return <Spin />;
  return <pre className="material-viewer material-text">{text}</pre>;
}

export default function CourseFileViewer({ blob, name }) {
  const ext = fileExt(name);
  const url = useObjectUrl(blob);

  if (!blob) return null;
  if (ext === 'pdf') return <PdfView blob={blob} />;
  if (IMAGE.has(ext)) {
    return url ? <img src={url} alt={name} style={{ display: 'block', maxWidth: '100%', margin: '0 auto' }} /> : <Spin />;
  }
  if (VIDEO.has(ext)) {
    return url ? <video src={url} controls style={{ width: '100%', maxHeight: '70vh' }} /> : <Spin />;
  }
  if (ext === 'docx') return <DocxView blob={blob} />;
  if (SHEET.has(ext)) return <SheetView blob={blob} />;
  if (ext === 'pptx') return <PptxView blob={blob} />;
  if (ext === 'txt') return <TextView blob={blob} />;
  return null;
}

function useObjectUrl(blob) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!blob) {
      setUrl('');
      return undefined;
    }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);
  return url;
}
