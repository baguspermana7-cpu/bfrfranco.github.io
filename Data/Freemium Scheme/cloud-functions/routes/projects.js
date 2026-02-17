/**
 * Project routes: /api/projects CRUD
 * Saved calculator configurations (Pro feature).
 */
const { Router } = require('express');
const { requireAuth } = require('../middleware/firebase-auth');
const { supaAdmin } = require('../services/supabase');

const router = Router();

/**
 * GET /api/projects — List user's saved projects.
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supaAdmin
      .from('projects')
      .select('id, calculator_type, name, config, calc_version, is_scenario_a, created_at, updated_at')
      .eq('user_id', req.user.uid)
      .order('updated_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch projects' });
    }
    res.json({ projects: data });
  } catch (err) {
    console.error('GET /api/projects error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/projects — Create a new project (save calculator config).
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { calculator_type, name, config, calc_version } = req.body;

    if (!calculator_type || !name || !config) {
      return res.status(400).json({ error: 'calculator_type, name, and config are required' });
    }

    // Check entitlements
    const { data: ent } = await supaAdmin
      .from('entitlements').select('can_save_projects, max_projects').eq('user_id', userId).single();

    if (!ent?.can_save_projects) {
      return res.status(403).json({ error: 'Upgrade to Pro to save projects' });
    }

    // Check project count limit
    const { count } = await supaAdmin
      .from('projects').select('id', { count: 'exact', head: true }).eq('user_id', userId);

    if (ent.max_projects > 0 && count >= ent.max_projects) {
      return res.status(403).json({ error: `Project limit reached (${ent.max_projects})` });
    }

    const { data, error } = await supaAdmin
      .from('projects')
      .insert({
        user_id: userId, calculator_type, name,
        config, calc_version: calc_version || 'v1.0'
      })
      .select().single();

    if (error) {
      return res.status(500).json({ error: 'Failed to create project' });
    }

    await supaAdmin.from('audit_log').insert({
      user_id: userId, action: 'SAVE_PROJECT',
      detail: { project_id: data.id, calculator_type }
    });

    res.status(201).json({ project: data });
  } catch (err) {
    console.error('POST /api/projects error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/projects/:id — Update a project.
 */
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { name, config, calc_version, is_scenario_a } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (config !== undefined) updates.config = config;
    if (calc_version !== undefined) updates.calc_version = calc_version;
    if (is_scenario_a !== undefined) updates.is_scenario_a = is_scenario_a;

    const { data, error } = await supaAdmin
      .from('projects')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user.uid)
      .select().single();

    if (error || !data) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ project: data });
  } catch (err) {
    console.error('PUT /api/projects/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/projects/:id — Delete a project.
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supaAdmin
      .from('projects')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.uid);

    if (error) {
      return res.status(500).json({ error: 'Failed to delete project' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/projects/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
