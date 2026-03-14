const studentMgmtService = require('../services/studentMgmtService');

class StudentMgmtController {
  // ─── Page render ─────────────────────────────────────────
  async index(req, res) {
    try {
      const [data, filterOptions] = await Promise.all([
        studentMgmtService.getStudents(req.query),
        studentMgmtService.getFilterOptions(),
      ]);

      res.render('pages/admin/students/index', {
        title: 'Student Management',
        layout: 'layouts/admin',
        ...data,
        filterOptions,
        query: req.query,
      });
    } catch (err) {
      console.error('Student mgmt error:', err);
      req.flash('error', 'Failed to load students');
      res.redirect('/admin');
    }
  }

  // ─── JSON: paginated list (for AJAX) ─────────────────────
  async apiList(req, res) {
    try {
      const data = await studentMgmtService.getStudents(req.query);
      res.json({ success: true, ...data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  // ─── JSON: single student profile ────────────────────────
  async apiProfile(req, res) {
    try {
      const student = await studentMgmtService.getStudentProfile(parseInt(req.params.id));
      if (!student) return res.status(404).json({ error: 'Student not found' });
      res.json({ success: true, student });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  // ─── POST: advanced filter (same as GET but via body) ────
  async apiFilter(req, res) {
    try {
      const data = await studentMgmtService.getStudents(req.body);
      res.json({ success: true, ...data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  // ─── POST: bulk action ───────────────────────────────────
  async apiBulkAction(req, res) {
    try {
      const { action, user_ids, ...payload } = req.body;
      const result = await studentMgmtService.bulkAction(action, user_ids, payload);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  // ─── POST: add skill ────────────────────────────────────
  async apiAddSkill(req, res) {
    try {
      const { skill_name, skill_type } = req.body;
      const skills = await studentMgmtService.addSkill(parseInt(req.params.id), skill_name, skill_type);
      res.json({ success: true, skills });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  // ─── DELETE: remove skill ────────────────────────────────
  async apiRemoveSkill(req, res) {
    try {
      const skills = await studentMgmtService.removeSkill(parseInt(req.params.id), parseInt(req.params.skillId));
      res.json({ success: true, skills });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  // ─── GET: Excel export ───────────────────────────────────
  async exportExcel(req, res) {
    try {
      const workbook = await studentMgmtService.exportStudents(req.query);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=students_export.xlsx');
      await workbook.xlsx.write(res);
      res.end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = new StudentMgmtController();
