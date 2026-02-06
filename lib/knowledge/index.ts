/**
 * YC Knowledge Base - Main Entry Point
 */

export * from './types';
export * from './knowledge-base';
export * from './skill-knowledge';
export * from './search';

// Re-export commonly used types
export {
  KnowledgeBase,
  getKnowledgeBase,
  resetKnowledgeBase,
} from './knowledge-base';

export {
  YCSkillKnowledge,
  getYCSkillKnowledge,
  type SkillResource,
  type SkillContent,
} from './skill-knowledge';

export {
  SearchUtils,
  parseQuery,
  generateSuggestions,
} from './search';
