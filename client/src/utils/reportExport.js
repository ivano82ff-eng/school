import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import PptxGenJS from 'pptxgenjs';

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadText(filename, text, mime) {
  downloadBlob(filename, new Blob([text], { type: mime }));
}

export function exportCsv(payload) {
  const lines = [`Отчёт;${payload.title}`, `Сгенерирован;${payload.generatedAt}`, ''];
  for (const w of payload.widgets || []) {
    lines.push(`## ${w.title || w.dataset}`);
    const series = w.data?.series || w.data?.table || [];
    if (!series.length) {
      lines.push('нет данных');
      lines.push('');
      continue;
    }
    const keys = Object.keys(series[0]);
    lines.push(keys.join(';'));
    for (const row of series) {
      lines.push(keys.map((k) => String(row[k] ?? '').replace(/;/g, ',')).join(';'));
    }
    lines.push('');
  }
  downloadText(`${slug(payload.title)}.csv`, lines.join('\n'), 'text/csv;charset=utf-8');
}

export function exportJson(payload) {
  downloadText(
    `${slug(payload.title)}.json`,
    JSON.stringify(payload, null, 2),
    'application/json'
  );
}

export function exportHtml(payload) {
  const widgetsHtml = (payload.widgets || [])
    .map((w) => {
      const series = w.data?.series || w.data?.table || [];
      const kpis = w.data?.kpis;
      let body = '';
      if (kpis) {
        body = `<ul>${Object.entries(kpis)
          .map(([k, v]) => `<li><b>${esc(k)}</b>: ${esc(v)}</li>`)
          .join('')}</ul>`;
      } else if (series.length) {
        const keys = Object.keys(series[0]);
        body = `<table><thead><tr>${keys.map((k) => `<th>${esc(k)}</th>`).join('')}</tr></thead><tbody>${series
          .map(
            (r) =>
              `<tr>${keys.map((k) => `<td>${esc(r[k])}</td>`).join('')}</tr>`
          )
          .join('')}</tbody></table>`;
        // simple spark bars for value
        if (series[0].value != null) {
          const max = Math.max(...series.map((r) => Number(r.value) || 0), 1);
          body += `<div class="bars">${series
            .map((r) => {
              const pct = Math.round(((Number(r.value) || 0) / max) * 100);
              return `<div class="bar-row"><span>${esc(r.name)}</span><div class="bar"><i style="width:${pct}%"></i></div><b>${esc(r.value)}</b></div>`;
            })
            .join('')}</div>`;
        }
      } else body = '<p>Нет данных</p>';
      return `<section><h2>${esc(w.title || w.dataset)}</h2><p class="meta">${esc(w.chartType || w.type)} · ${esc(w.dataset || '')}</p>${body}</section>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"/>
<title>${esc(payload.title)}</title>
<style>
body{font-family:Segoe UI,system-ui,sans-serif;margin:32px;color:#2C3E50;background:#F5F7FA}
h1{color:#8E6FAF} section{background:#fff;border-radius:12px;padding:16px 20px;margin:16px 0;box-shadow:0 1px 4px rgba(0,0,0,.06)}
table{border-collapse:collapse;width:100%;margin-top:8px} th,td{border:1px solid #e5e7eb;padding:6px 8px;text-align:left;font-size:13px}
.meta{color:#6B7C93;font-size:12px}.bar-row{display:grid;grid-template-columns:140px 1fr 64px;gap:8px;align-items:center;margin:4px 0}
.bar{background:#eee;border-radius:6px;height:10px;overflow:hidden}.bar i{display:block;height:100%;background:#8E6FAF}
@media print{body{background:#fff;margin:12px} section{box-shadow:none;border:1px solid #ddd}}
</style></head><body>
<h1>${esc(payload.title)}</h1>
<p>Сформировано: ${esc(payload.generatedAt)} · IT-Scool Analytics</p>
${widgetsHtml}
</body></html>`;

  downloadText(`${slug(payload.title)}.html`, html, 'text/html;charset=utf-8');
}

export async function exportPdfFromElement(el, filename) {
  if (!el) throw new Error('Нет области для PDF');
  const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#F5F7FA' });
  const img = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
  const w = canvas.width * ratio;
  const h = canvas.height * ratio;
  pdf.addImage(img, 'PNG', (pageW - w) / 2, 16, w, h);
  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

export async function exportPptx(payload) {
  const pptx = new PptxGenJS();
  pptx.author = 'IT-Scool';
  pptx.title = payload.title;

  const cover = pptx.addSlide();
  cover.addText(payload.title || 'Отчёт', {
    x: 0.5,
    y: 2,
    w: 9,
    h: 1,
    fontSize: 32,
    color: '8E6FAF',
    bold: true,
  });
  cover.addText(`IT-Scool · ${payload.generatedAt}`, {
    x: 0.5,
    y: 3.2,
    w: 9,
    h: 0.4,
    fontSize: 14,
    color: '6B7C93',
  });

  for (const w of payload.widgets || []) {
    const slide = pptx.addSlide();
    slide.addText(w.title || w.dataset || 'Виджет', {
      x: 0.4,
      y: 0.3,
      w: 9,
      h: 0.5,
      fontSize: 20,
      bold: true,
      color: '2C3E50',
    });

    const series = w.data?.series || [];
    if (w.data?.kpis) {
      const entries = Object.entries(w.data.kpis);
      entries.forEach(([k, v], i) => {
        const x = 0.4 + (i % 4) * 2.3;
        const y = 1.2 + Math.floor(i / 4) * 1.4;
        slide.addShape(pptx.ShapeType.roundRect, {
          x,
          y,
          w: 2.1,
          h: 1.1,
          fill: { color: 'FFFFFF' },
          shadow: { type: 'outer', color: '000000', blur: 4, opacity: 0.08 },
        });
        slide.addText(String(k), { x, y: y + 0.15, w: 2.1, h: 0.3, fontSize: 11, color: '6B7C93', align: 'center' });
        slide.addText(String(v), { x, y: y + 0.45, w: 2.1, h: 0.45, fontSize: 22, bold: true, color: '8E6FAF', align: 'center' });
      });
      continue;
    }

    if (series.length && series[0].value != null) {
      const chartType =
        w.chartType === 'pie' ? 'pie' : w.chartType === 'line' ? 'line' : 'bar';
      try {
        slide.addChart(
          chartType,
          [
            {
              name: w.title || 'Серия',
              labels: series.map((r) => String(r.name)),
              values: series.map((r) => Number(r.value) || 0),
            },
          ],
          {
            x: 0.5,
            y: 1,
            w: 9,
            h: 4.2,
            showTitle: false,
            showLegend: true,
          }
        );
      } catch {
        const rows = series.slice(0, 12).map((r) => [String(r.name), String(r.value)]);
        slide.addTable([['Показатель', 'Значение'], ...rows], {
          x: 0.5,
          y: 1,
          w: 9,
          colW: [5, 4],
          border: [{ pt: 0.5, color: 'CCCCCC' }],
          fontSize: 12,
        });
      }
    } else {
      const table = w.data?.table || series;
      if (table?.length) {
        const keys = Object.keys(table[0]).slice(0, 5);
        const rows = table.slice(0, 10).map((r) => keys.map((k) => String(r[k] ?? '')));
        slide.addTable([keys, ...rows], {
          x: 0.4,
          y: 1,
          w: 9.2,
          border: [{ pt: 0.5, color: 'CCCCCC' }],
          fontSize: 11,
        });
      } else {
        slide.addText('Нет данных', { x: 0.5, y: 2, w: 9, h: 0.5, color: '6B7C93' });
      }
    }
  }

  await pptx.writeFile({ fileName: `${slug(payload.title)}.pptx` });
}

function slug(s) {
  return String(s || 'report')
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'report';
}

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
