/**
 * YC Knowledge Base - Main Entry Point
 */

export * from './types';
export * from './knowledge-base';
export * from './skill-knowledge-simple';
export * from './search';

// Re-export commonly used types
export {
  KnowledgeBase,
  getKnowledgeBase,
  resetKnowledgeBase,
} from './knowledge-base';

// Use simplified version that works on Vercel
export {
  YCSkillKnowledge,
  getYCSkillKnowledge,
  type SkillContent,
} from './skill-knowledge-simple';

export {
  SearchUtils,
  parseQuery,
  generateSuggestions,
} from './search';
