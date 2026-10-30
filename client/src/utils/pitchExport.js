import { jsPDF } from 'jspdf';
import PptxGenJS from 'pptxgenjs';

const ACCENT = '8E6FAF';
const TEXT = '2C3E50';
const MUTED = '6B7C93';

async function toDataUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Не удалось загрузить ${url}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function addFooter(slide, pptx) {
  slide.addText('IT-Scool · презентация платформы', {
    x: 0.4,
    y: 5.15,
    w: 9.2,
    h: 0.3,
    fontSize: 10,
    color: MUTED,
  });
}

/**
 * @param {{
 *   screenshots: { src: string, title: string, caption: string }[],
 *   modules: { title: string, tag: string, points: string[] }[],
 *   roles: { role: string, sees: string, forWhom: string }[],
 *   journeys: { title: string, steps: string[] }[],
 *   demo: { role: string, login: string, pass: string }[],
 * }} data
 */
export async function exportPitchPptx(data) {
  const pptx = new PptxGenJS();
  pptx.author = 'IT-Scool';
  pptx.title = 'IT-Scool — презентация платформы';
  pptx.subject = 'MVP IT-школы: обучение, офис, маркетинг, аналитика';

  const cover = pptx.addSlide();
  cover.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10,
    h: 5.625,
    fill: { color: '6B4F8A' },
  });
  cover.addText('IT-Scool', {
    x: 0.6,
    y: 1.4,
    w: 8.8,
    h: 0.9,
    fontSize: 44,
    bold: true,
    color: 'FFFFFF',
  });
  cover.addText(
    'Платформа IT-школы: обучение, офис, маркетинг и аналитика в одном продукте',
    {
      x: 0.6,
      y: 2.4,
      w: 8.5,
      h: 1.1,
      fontSize: 20,
      color: 'FFFFFF',
    }
  );
  cover.addText('MVP · курсы 1–11 классов · презентация для заказчика', {
    x: 0.6,
    y: 4.6,
    w: 8.5,
    h: 0.35,
    fontSize: 13,
    color: 'E8DFF0',
  });

  const overview = pptx.addSlide();
  overview.addText('Что это за продукт', {
    x: 0.5,
    y: 0.35,
    w: 9,
    h: 0.5,
    fontSize: 26,
    bold: true,
    color: ACCENT,
  });
  overview.addText(
    [
      {
        text: 'Единая веб-платформа для IT-школы: ученики учатся, преподаватели ведут контент и группы, офис закрывает CRM и оплаты, родители видят прогресс, маркетолог запускает лендинги, аналитик собирает отчёты.\n\n',
        options: { breakLine: false },
      },
      {
        text: '• Курсы Scratch, Python, веб, алгоритмы — классы 1–11\n',
        options: { breakLine: false },
      },
      {
        text: '• Один вход — разные кабинеты по роли (RBAC)\n',
        options: { breakLine: false },
      },
      {
        text: '• Стек: React + Express + SQLite, один процесс Node\n',
        options: { breakLine: false },
      },
      {
        text: '• Статус: MVP — готов к пилоту и демонстрации',
        options: { breakLine: false },
      },
    ],
    { x: 0.5, y: 1.1, w: 9, h: 3.6, fontSize: 15, color: TEXT, valign: 'top' }
  );
  addFooter(overview, pptx);

  for (const shot of data.screenshots || []) {
    const slide = pptx.addSlide();
    slide.addText(shot.title, {
      x: 0.4,
      y: 0.2,
      w: 9.2,
      h: 0.4,
      fontSize: 20,
      bold: true,
      color: TEXT,
    });
    try {
      const img = await toDataUrl(shot.src);
      slide.addImage({
        data: img,
        x: 0.5,
        y: 0.7,
        w: 9,
        h: 3.9,
        sizing: { type: 'contain', w: 9, h: 3.9 },
      });
    } catch {
      slide.addText('(изображение недоступно)', {
        x: 0.5,
        y: 2.2,
        w: 9,
        h: 0.4,
        color: MUTED,
        align: 'center',
      });
    }
    slide.addText(shot.caption || '', {
      x: 0.4,
      y: 4.7,
      w: 9.2,
      h: 0.45,
      fontSize: 11,
      color: MUTED,
    });
  }

  for (const mod of data.modules || []) {
    const slide = pptx.addSlide();
    slide.addText(mod.title, {
      x: 0.5,
      y: 0.3,
      w: 7,
      h: 0.45,
      fontSize: 24,
      bold: true,
      color: ACCENT,
    });
    slide.addText(mod.tag || '', {
      x: 0.5,
      y: 0.8,
      w: 9,
      h: 0.3,
      fontSize: 13,
      color: MUTED,
    });
    const bullets = (mod.points || []).map((p) => ({
      text: p,
      options: { bullet: true, breakLine: true },
    }));
    slide.addText(bullets, {
      x: 0.5,
      y: 1.25,
      w: 9,
      h: 3.6,
      fontSize: 14,
      color: TEXT,
      valign: 'top',
    });
    addFooter(slide, pptx);
  }

  const roles = pptx.addSlide();
  roles.addText('Роли и доступ', {
    x: 0.4,
    y: 0.25,
    w: 9,
    h: 0.4,
    fontSize: 24,
    bold: true,
    color: ACCENT,
  });
  const roleRows = [
    [
      { text: 'Роль', options: { bold: true, color: 'FFFFFF', fill: { color: ACCENT } } },
      { text: 'Доступ', options: { bold: true, color: 'FFFFFF', fill: { color: ACCENT } } },
      { text: 'Для кого', options: { bold: true, color: 'FFFFFF', fill: { color: ACCENT } } },
    ],
    ...(data.roles || []).map((r) => [r.role, r.sees, r.forWhom]),
  ];
  roles.addTable(roleRows, {
    x: 0.3,
    y: 0.8,
    w: 9.4,
    colW: [1.8, 4.4, 3.2],
    border: [{ pt: 0.5, color: 'CCCCCC' }],
    fontSize: 10,
    color: TEXT,
    align: 'left',
    valign: 'middle',
  });
  addFooter(roles, pptx);

  for (const j of data.journeys || []) {
    const slide = pptx.addSlide();
    slide.addText(j.title, {
      x: 0.5,
      y: 0.35,
      w: 9,
      h: 0.5,
      fontSize: 24,
      bold: true,
      color: ACCENT,
    });
    slide.addText(
      (j.steps || []).map((s, i) => ({
        text: `${i + 1}. ${s}`,
        options: { breakLine: true },
      })),
      { x: 0.5, y: 1.1, w: 9, h: 3.6, fontSize: 15, color: TEXT, valign: 'top' }
    );
    addFooter(slide, pptx);
  }

  const demo = pptx.addSlide();
  demo.addText('Демо-доступ', {
    x: 0.5,
    y: 0.35,
    w: 9,
    h: 0.45,
    fontSize: 24,
    bold: true,
    color: ACCENT,
  });
  demo.addText('После npm run seed. Выйдите и войдите под нужной ролью.', {
    x: 0.5,
    y: 0.9,
    w: 9,
    h: 0.35,
    fontSize: 12,
    color: MUTED,
  });
  const demoRows = [
    [
      { text: 'Роль', options: { bold: true } },
      { text: 'Логин', options: { bold: true } },
      { text: 'Пароль', options: { bold: true } },
    ],
    ...(data.demo || []).map((d) => [d.role, d.login, d.pass]),
  ];
  demo.addTable(demoRows, {
    x: 0.5,
    y: 1.4,
    w: 9,
    colW: [2.2, 4.3, 2.5],
    border: [{ pt: 0.5, color: 'CCCCCC' }],
    fontSize: 12,
    color: TEXT,
  });
  addFooter(demo, pptx);

  const end = pptx.addSlide();
  end.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10,
    h: 5.625,
    fill: { color: '6B4F8A' },
  });
  end.addText('Готовы к пилоту', {
    x: 0.6,
    y: 1.8,
    w: 8.8,
    h: 0.7,
    fontSize: 32,
    bold: true,
    color: 'FFFFFF',
  });
  end.addText(
    'Онлайн-преза: /product · Заявка: /apply · Демо-лендинг: /l/python-leto',
    {
      x: 0.6,
      y: 2.7,
      w: 8.8,
      h: 0.6,
      fontSize: 14,
      color: 'E8DFF0',
    }
  );

  await pptx.writeFile({ fileName: 'IT-Scool-prezentaciya.pptx' });
}

/**
 * Multi-page PDF: text summary + screenshots.
 */
export async function exportPitchPdf(data) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 40;

  function titlePage(title, subtitle) {
    pdf.setFillColor(107, 79, 138);
    pdf.rect(0, 0, pageW, pageH, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(36);
    pdf.text('IT-Scool', margin, 160);
    pdf.setFontSize(18);
    const lines = pdf.splitTextToSize(title, pageW - margin * 2);
    pdf.text(lines, margin, 220);
    if (subtitle) {
      pdf.setFontSize(12);
      pdf.setTextColor(232, 223, 240);
      pdf.text(subtitle, margin, pageH - 50);
    }
  }

  function sectionTitle(t) {
    pdf.setTextColor(142, 111, 175);
    pdf.setFontSize(22);
    pdf.text(t, margin, 50);
  }

  titlePage(
    'Платформа IT-школы: обучение, офис, маркетинг и аналитика',
    'MVP · презентация для заказчика'
  );

  pdf.addPage();
  sectionTitle('Что это за продукт');
  pdf.setTextColor(44, 62, 80);
  pdf.setFontSize(12);
  const overviewText = pdf.splitTextToSize(
    'Единая веб-платформа для IT-школы: ученики, преподаватели, офис/CRM, родители, маркетинг-лендинги и аналитика. Курсы 1–11 классов. RBAC-роли. Стек React + Express + SQLite.',
    pageW - margin * 2
  );
  pdf.text(overviewText, margin, 90);

  let y = 140;
  for (const mod of data.modules || []) {
    if (y > pageH - 100) {
      pdf.addPage();
      sectionTitle('Функционал');
      y = 90;
    }
    pdf.setFontSize(14);
    pdf.setTextColor(142, 111, 175);
    pdf.text(`${mod.title} (${mod.tag || ''})`, margin, y);
    y += 18;
    pdf.setFontSize(11);
    pdf.setTextColor(44, 62, 80);
    for (const p of mod.points || []) {
      const lines = pdf.splitTextToSize(`• ${p}`, pageW - margin * 2);
      if (y + lines.length * 14 > pageH - 40) {
        pdf.addPage();
        y = 50;
      }
      pdf.text(lines, margin, y);
      y += lines.length * 14 + 2;
    }
    y += 12;
  }

  for (const shot of data.screenshots || []) {
    pdf.addPage();
    sectionTitle(shot.title);
    pdf.setFontSize(11);
    pdf.setTextColor(107, 124, 147);
    const cap = pdf.splitTextToSize(shot.caption || '', pageW - margin * 2);
    pdf.text(cap, margin, 70);
    try {
      const img = await toDataUrl(shot.src);
      const maxW = pageW - margin * 2;
      const maxH = pageH - 130;
      const props = pdf.getImageProperties(img);
      const ratio = Math.min(maxW / props.width, maxH / props.height);
      const w = props.width * ratio;
      const h = props.height * ratio;
      pdf.addImage(img, 'PNG', margin, 95, w, h, undefined, 'FAST');
    } catch {
      pdf.setTextColor(150, 150, 150);
      pdf.text('(изображение недоступно)', margin, 160);
    }
  }

  pdf.addPage();
  sectionTitle('Роли');
  pdf.setFontSize(11);
  pdf.setTextColor(44, 62, 80);
  y = 90;
  for (const r of data.roles || []) {
    const line = pdf.splitTextToSize(
      `${r.role} — ${r.sees} (${r.forWhom})`,
      pageW - margin * 2
    );
    if (y + line.length * 14 > pageH - 40) {
      pdf.addPage();
      y = 50;
    }
    pdf.text(line, margin, y);
    y += line.length * 14 + 8;
  }

  pdf.addPage();
  sectionTitle('Демо-доступ');
  pdf.setFontSize(12);
  pdf.setTextColor(44, 62, 80);
  y = 90;
  for (const d of data.demo || []) {
    pdf.text(`${d.role}: ${d.login} / ${d.pass}`, margin, y);
    y += 22;
  }
  pdf.setFontSize(11);
  pdf.setTextColor(107, 124, 147);
  pdf.text('Онлайн: /product · Заявка: /apply · Лендинг: /l/python-leto', margin, pageH - 40);

  pdf.save('IT-Scool-prezentaciya.pdf');
}
