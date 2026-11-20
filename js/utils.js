export function renderBrandSVG(logoUrl = '') {
  if (logoUrl) {
    return `<img src="${logoUrl}" alt="Logotipo Pequeños Exploradores" style="width:100%; height:100%; object-fit:contain; border-radius:6px;" />`;
  }
  return `
    <svg viewBox="0 0 120 120" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Emblema Pequeños Exploradores">
      <rect x="6" y="6" width="108" height="108" rx="22" fill="#102B50"/>
      <path d="M26 26H56V40C59.5 40 62 42.5 62 46C62 49.5 59.5 52 56 52V58H44C44 54.5 41.5 52 38 52C34.5 52 32 54.5 32 58H26V26Z" fill="#FFC928"/>
      <path d="M62 26H94V58H86C86 54.5 83.5 52 80 52C76.5 52 74 54.5 74 58H62V52C65.5 52 68 49.5 68 46C68 42.5 65.5 40 62 40V26Z" fill="#ED4545"/>
      <path d="M26 62H32C32 58.5 34.5 56 38 56C41.5 56 44 58.5 44 62H56V74C59.5 74 62 76.5 62 80C62 83.5 59.5 86 56 86V94H26V62Z" fill="#45A66A"/>
      <path d="M62 62H74C74 58.5 76.5 56 80 56C83.5 56 86 58.5 86 62H94V94H62V86C65.5 86 68 83.5 68 80C68 76.5 65.5 74 62 74V62Z" fill="#1677E8"/>
      <path d="M35 83C35 76 41 72 47 72C47 78 43 83 35 83Z" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="78" cy="41" r="6" stroke="#FFFFFF" stroke-width="2.4"/>
      <path d="M83 46L87 50" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round"/>
    </svg>
  `;
}

export function formatCOP(value) {
  const num = Number(value || 0);
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(num);
}

export function formatDateES(isoDate) {
  if (!isoDate) return 'Por confirmar';
  const [y, m, d] = isoDate.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

export function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export function downloadCSV(filename, rows) {
  const csvContent = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
        .join(';')
    )
    .join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}