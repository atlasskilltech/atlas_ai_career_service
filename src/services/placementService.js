const repo = require('../repositories/placementRepo');

class PlacementService {
  // ─── Dashboard data (all in one) ─────────────────────────

  async getDashboardData(filters = {}) {
    const [summary, programBreakdown, branchBreakdown, industryDist, salaryDist, monthWise, topCompanies, batchTracker, filterOptions] = await Promise.all([
      repo.getSummary(filters),
      repo.getProgramBreakdown(filters),
      repo.getBranchBreakdown(filters),
      repo.getIndustryDistribution(filters),
      repo.getSalaryDistribution(filters),
      repo.getMonthWise(filters),
      repo.getTopCompanies(filters),
      repo.getBatchTracker(),
      repo.getFilterOptions()
    ]);
    return { summary, programBreakdown, branchBreakdown, industryDist, salaryDist, monthWise, topCompanies, batchTracker, filterOptions };
  }

  async getTrends() {
    return repo.getYearOverYear();
  }

  // ─── Excel export (multi-sheet) ──────────────────────────

  async exportExcel(filters = {}) {
    const ExcelJS = require('exceljs');

    const [placements, summary, programBreakdown, branchBreakdown, topCompanies] = await Promise.all([
      repo.getAllPlacements(filters),
      repo.getSummary(filters),
      repo.getProgramBreakdown(filters),
      repo.getBranchBreakdown(filters),
      repo.getTopCompanies(filters, 50)
    ]);

    const wb = new ExcelJS.Workbook();
    const headerStyle = { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF001B3D' } } };

    // Sheet 1: All Placements
    const ws1 = wb.addWorksheet('Placements');
    ws1.columns = [
      { header: 'Student', key: 'student_name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Program', key: 'program', width: 20 },
      { header: 'Branch', key: 'branch', width: 20 },
      { header: 'Grad Year', key: 'graduation_year', width: 12 },
      { header: 'Company', key: 'company_name', width: 25 },
      { header: 'Role', key: 'role_title', width: 25 },
      { header: 'Job Type', key: 'job_type', width: 12 },
      { header: 'CTC Min', key: 'ctc_min', width: 12 },
      { header: 'CTC Max', key: 'ctc_max', width: 12 },
      { header: 'Location', key: 'location', width: 18 },
      { header: 'Work Mode', key: 'work_mode', width: 12 },
      { header: 'Placed On', key: 'placed_at', width: 15 }
    ];
    this._styleHeader(ws1, headerStyle);
    placements.forEach(p => ws1.addRow(p));

    // Sheet 2: Summary
    const ws2 = wb.addWorksheet('Summary');
    ws2.columns = [
      { header: 'Metric', key: 'metric', width: 20 },
      { header: 'Value', key: 'value', width: 20 }
    ];
    this._styleHeader(ws2, headerStyle);
    ws2.addRow({ metric: 'Total Placed', value: summary.total_placed });
    ws2.addRow({ metric: 'Total Eligible', value: summary.total_eligible });
    ws2.addRow({ metric: 'Placement %', value: summary.placement_pct + '%' });
    ws2.addRow({ metric: 'Average CTC', value: summary.avg_ctc });
    ws2.addRow({ metric: 'Highest CTC', value: summary.highest_ctc });
    ws2.addRow({ metric: 'Median CTC', value: summary.median_ctc });
    ws2.addRow({ metric: 'Unplaced', value: summary.unplaced_count });

    // Sheet 3: Program Breakdown
    const ws3 = wb.addWorksheet('By Program');
    ws3.columns = [
      { header: 'Program', key: 'program', width: 30 },
      { header: 'Eligible', key: 'eligible', width: 12 },
      { header: 'Placed', key: 'placed', width: 12 },
      { header: 'Placement %', key: 'pct', width: 14 },
      { header: 'Avg CTC', key: 'avg_ctc', width: 14 }
    ];
    this._styleHeader(ws3, headerStyle);
    programBreakdown.forEach(p => ws3.addRow(p));

    // Sheet 4: Branch Breakdown
    const ws4 = wb.addWorksheet('By Branch');
    ws4.columns = [
      { header: 'Branch', key: 'branch', width: 25 },
      { header: 'Placed', key: 'placed', width: 12 },
      { header: 'Avg CTC', key: 'avg_ctc', width: 14 }
    ];
    this._styleHeader(ws4, headerStyle);
    branchBreakdown.forEach(b => ws4.addRow(b));

    // Sheet 5: Top Companies
    const ws5 = wb.addWorksheet('Top Companies');
    ws5.columns = [
      { header: 'Company', key: 'company', width: 30 },
      { header: 'Hired', key: 'hired', width: 10 },
      { header: 'Avg CTC', key: 'avg_ctc', width: 14 },
      { header: 'Highest CTC', key: 'highest_ctc', width: 14 }
    ];
    this._styleHeader(ws5, headerStyle);
    topCompanies.forEach(c => ws5.addRow(c));

    return wb;
  }

  // ─── PDF export (Puppeteer) ──────────────────────────────

  async exportPDF(filters = {}) {
    let puppeteer;
    try {
      puppeteer = require('puppeteer');
    } catch {
      throw new Error('Puppeteer not available for PDF export');
    }

    const [summary, programBreakdown, branchBreakdown, topCompanies, batchTracker] = await Promise.all([
      repo.getSummary(filters),
      repo.getProgramBreakdown(filters),
      repo.getBranchBreakdown(filters),
      repo.getTopCompanies(filters),
      repo.getBatchTracker()
    ]);

    const yearLabel = filters.academic_year || 'All Years';
    const html = this._buildPDFHtml(summary, programBreakdown, branchBreakdown, topCompanies, batchTracker, yearLabel);

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' }
    });
    await browser.close();
    return pdfBuffer;
  }

  // ─── Summary PDF (1-page infographic) ────────────────────

  async exportSummaryPDF(filters = {}) {
    let puppeteer;
    try {
      puppeteer = require('puppeteer');
    } catch {
      throw new Error('Puppeteer not available for PDF export');
    }

    const summary = await repo.getSummary(filters);
    const yearLabel = filters.academic_year || 'All Years';
    const html = this._buildSummaryHtml(summary, yearLabel);

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }
    });
    await browser.close();
    return pdfBuffer;
  }

  // ─── Helpers ─────────────────────────────────────────────

  _styleHeader(ws, style) {
    const row = ws.getRow(1);
    row.font = style.font;
    row.fill = style.fill;
  }

  _formatCTC(val) {
    if (!val) return '-';
    return val >= 100000 ? '₹' + (val / 100000).toFixed(1) + 'L' : '₹' + Number(val).toLocaleString('en-IN');
  }

  _buildPDFHtml(summary, programs, branches, companies, batches, yearLabel) {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',system-ui,sans-serif; color:#1a1a1a; font-size:11px; line-height:1.4; }
  .header { background:#001B3D; color:#fff; padding:20px 24px; margin-bottom:16px; }
  .header h1 { font-size:20px; font-weight:700; }
  .header p { font-size:11px; opacity:0.8; margin-top:4px; }
  .section { margin:0 16px 16px; }
  .section h2 { font-size:13px; font-weight:700; color:#001B3D; border-bottom:2px solid #5FA302; padding-bottom:4px; margin-bottom:10px; }
  .metrics { display:grid; grid-template-columns:repeat(6,1fr); gap:8px; margin:0 16px 16px; }
  .metric-card { background:#f8f9fa; border:1px solid #e5e7eb; border-radius:8px; padding:10px; text-align:center; }
  .metric-card .val { font-size:18px; font-weight:700; color:#001B3D; }
  .metric-card .lbl { font-size:9px; color:#6b7280; margin-top:2px; }
  table { width:100%; border-collapse:collapse; font-size:10px; }
  th { background:#001B3D; color:#fff; padding:6px 8px; text-align:left; font-weight:600; }
  td { padding:5px 8px; border-bottom:1px solid #e5e7eb; }
  tr:nth-child(even) { background:#f9fafb; }
  .two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .footer { text-align:center; font-size:9px; color:#9ca3af; margin-top:20px; padding:10px; border-top:1px solid #e5e7eb; }
</style></head><body>
  <div class="header">
    <h1>Placement Report — Atlas SkillTech University</h1>
    <p>Academic Year: ${yearLabel} | Generated: ${new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })}</p>
  </div>

  <div class="metrics">
    <div class="metric-card"><div class="val">${summary.total_placed}</div><div class="lbl">Total Placed</div></div>
    <div class="metric-card"><div class="val">${summary.placement_pct}%</div><div class="lbl">Placement %</div></div>
    <div class="metric-card"><div class="val">${this._formatCTC(summary.avg_ctc)}</div><div class="lbl">Avg CTC</div></div>
    <div class="metric-card"><div class="val">${this._formatCTC(summary.highest_ctc)}</div><div class="lbl">Highest CTC</div></div>
    <div class="metric-card"><div class="val">${this._formatCTC(summary.median_ctc)}</div><div class="lbl">Median CTC</div></div>
    <div class="metric-card"><div class="val">${summary.unplaced_count}</div><div class="lbl">Unplaced</div></div>
  </div>

  <div class="two-col">
    <div class="section">
      <h2>Program-wise Placement</h2>
      <table><thead><tr><th>Program</th><th>Placed</th><th>%</th><th>Avg CTC</th></tr></thead><tbody>
        ${programs.map(p => `<tr><td>${p.program}</td><td>${p.placed}</td><td>${p.pct}%</td><td>${this._formatCTC(p.avg_ctc)}</td></tr>`).join('')}
      </tbody></table>
    </div>
    <div class="section">
      <h2>Branch-wise Placement</h2>
      <table><thead><tr><th>Branch</th><th>Placed</th><th>Avg CTC</th></tr></thead><tbody>
        ${branches.map(b => `<tr><td>${b.branch}</td><td>${b.placed}</td><td>${this._formatCTC(b.avg_ctc)}</td></tr>`).join('')}
      </tbody></table>
    </div>
  </div>

  <div class="section">
    <h2>Top Recruiting Companies</h2>
    <table><thead><tr><th>Company</th><th>Hired</th><th>Avg CTC</th><th>Highest CTC</th></tr></thead><tbody>
      ${companies.map(c => `<tr><td>${c.company}</td><td>${c.hired}</td><td>${this._formatCTC(c.avg_ctc)}</td><td>${this._formatCTC(c.highest_ctc)}</td></tr>`).join('')}
    </tbody></table>
  </div>

  <div class="section">
    <h2>Batch Tracker</h2>
    <table><thead><tr><th>Graduation Year</th><th>Eligible</th><th>Placed</th><th>Placement %</th></tr></thead><tbody>
      ${batches.map(b => `<tr><td>${b.graduation_year}</td><td>${b.total_eligible}</td><td>${b.placed}</td><td>${b.pct}%</td></tr>`).join('')}
    </tbody></table>
  </div>

  <div class="footer">Atlas SkillTech University — Career Services | Confidential — For NAAC/Accreditation Use</div>
</body></html>`;
  }

  _buildSummaryHtml(summary, yearLabel) {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',system-ui,sans-serif; background:#001B3D; color:#fff; }
  .page { width:100%; height:100%; padding:30px; display:flex; flex-direction:column; justify-content:center; }
  .title { font-size:28px; font-weight:800; text-align:center; margin-bottom:6px; }
  .subtitle { font-size:13px; text-align:center; opacity:0.7; margin-bottom:30px; }
  .cards { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:24px; }
  .card { background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); border-radius:12px; padding:20px; text-align:center; }
  .card .val { font-size:32px; font-weight:800; color:#5FA302; }
  .card .lbl { font-size:11px; opacity:0.6; margin-top:6px; text-transform:uppercase; letter-spacing:0.05em; }
  .bottom-row { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
  .bottom-card { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:16px; text-align:center; }
  .bottom-card .val { font-size:24px; font-weight:700; }
  .bottom-card .lbl { font-size:10px; opacity:0.5; margin-top:4px; text-transform:uppercase; }
  .footer { text-align:center; font-size:9px; opacity:0.4; margin-top:30px; }
</style></head><body>
<div class="page">
  <div class="title">Placement Summary</div>
  <div class="subtitle">Atlas SkillTech University | ${yearLabel} | Generated ${new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })}</div>

  <div class="cards">
    <div class="card"><div class="val">${summary.total_placed}</div><div class="lbl">Students Placed</div></div>
    <div class="card"><div class="val">${summary.placement_pct}%</div><div class="lbl">Placement Rate</div></div>
    <div class="card"><div class="val">${this._formatCTC(summary.avg_ctc)}</div><div class="lbl">Average CTC</div></div>
  </div>

  <div class="bottom-row">
    <div class="bottom-card"><div class="val" style="color:#f59e0b">${this._formatCTC(summary.highest_ctc)}</div><div class="lbl">Highest CTC</div></div>
    <div class="bottom-card"><div class="val" style="color:#3b82f6">${this._formatCTC(summary.median_ctc)}</div><div class="lbl">Median CTC</div></div>
    <div class="bottom-card"><div class="val" style="color:#ef4444">${summary.unplaced_count}</div><div class="lbl">Yet to be Placed</div></div>
  </div>

  <div class="footer">Confidential — Career Services | For Accreditation & Internal Review</div>
</div>
</body></html>`;
  }

  // ─── Filter options ──────────────────────────────────────

  async getFilterOptions() {
    return repo.getFilterOptions();
  }
}

module.exports = new PlacementService();
