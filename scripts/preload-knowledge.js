#!/usr/bin/env node
/**
 * Build-time script to preload YC Skill knowledge base
 * Run this during `next build` to load all references into memory
 */

const { YCSkillKnowledge } = require('../lib/knowledge/skill-knowledge');

async function preload() {
  console.log('🚀 Preloading YC Skill knowledge base...');
  
  try {
    await YCSkillKnowledge.buildTimeInit();
    console.log('✅ Preload complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Preload failed:', error);
    process.exit(1);
  }
}

preload();
