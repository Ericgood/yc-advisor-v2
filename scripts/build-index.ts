/**
 * Build Knowledge Index from YAML source
 * Converts index.yaml to optimized JSON index
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';

// ============================================================================
// Types
// ============================================================================

interface YamlResource {
  code: string;
  file: string;
  title: string;
  author: string;
  type: 'essay' | 'video' | 'podcast';
  url: string;
  topics: string[];
  founder_stage: string[];
  related: string[];
  lines: number;
}

interface YamlIndex {
  version: string;
  total_resources: number;
  resources: YamlResource[];
}

interface KnowledgeIndex {
  version: string;
  generatedAt: string;
  stats: {
    totalResources: number;
    totalCategories: number;
    totalLines: number;
    totalAuthors: number;
  };
  categories: Record<string, { count: number; resources: string[] }>;
  resources: Record<string, {
    code: string;
    title: string;
    author: string;
    type: string;
    url: string;
    topics: string[];
    founderStage: string[];
    lines: number;
    filePath: string;
    hasTranscript: boolean;
    related: string[];
  }>;
  searchIndex: {
    byAuthor: Record<string, string[]>;
    byType: Record<string, string[]>;
    byStage: Record<string, string[]>;
    keywords: Record<string, string[]>;
  };
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_MAPPINGS: Record<string, string> = {
  'accelerator': 'accelerator',
  'admin': 'admin',
  'ai': 'ai',
  'avoiding failure': 'avoiding-failure',
  'b2b': 'b2b',
  'biotech': 'biotech',
  'building': 'building',
  'career': 'career',
  'case study': 'case-study',
  'co founders': 'co-founders',
  'crypto': 'crypto',
  'culture': 'culture',
  'customers': 'customers',
  'deep tech': 'deep-tech',
  'design': 'design',
  'engineering': 'engineering',
  'finance': 'finance',
  'founder interview': 'founder-interview',
  'fundraising': 'fundraising',
  'general': 'general',
  'getting started': 'getting-started',
  'governance': 'governance',
  'growth': 'growth',
  'hiring': 'hiring',
  'launching': 'launching',
  'leadership': 'leadership',
  'metrics': 'metrics',
  'mindset': 'mindset',
  'pivoting': 'pivoting',
  'pricing': 'pricing',
  'scaling': 'scaling',
};

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
  'how', 'what', 'when', 'where', 'why', 'who', 'which'
]);

// ============================================================================
// Helper Functions
// ============================================================================

/** Normalize category name */
function normalizeCategory(topic: string): string {
  const normalized = topic.toLowerCase().trim();
  return CATEGORY_MAPPINGS[normalized] || normalized.replace(/\s+/g, '-');
}

/** Extract keywords from text */
function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => 
      word.length > 2 && !STOP_WORDS.has(word)
    );
}

/** Build inverted keyword index */
function buildKeywordIndex(resources: YamlResource[]): Record<string, string[]> {
  const index: Record<string, Set<string>> = {};
  
  for (const resource of resources) {
    // Extract keywords from title
    const titleKeywords = extractKeywords(resource.title);
    
    // Extract keywords from topics
    const topicKeywords = resource.topics.flatMap(extractKeywords);
    
    // Combine all keywords
    const allKeywords = new Set([...titleKeywords, ...topicKeywords]);
    
    // Add to index
    for (const keyword of allKeywords) {
      if (!index[keyword]) {
        index[keyword] = new Set();
      }
      index[keyword].add(resource.code);
    }
  }
  
  // Convert sets to arrays
  const result: Record<string, string[]> = {};
  for (const [keyword, codes] of Object.entries(index)) {
    result[keyword] = Array.from(codes);
  }
  
  return result;
}

/** Check if file has transcript */
async function hasTranscript(filePath: string): Promise<boolean> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    // Has transcript if content has more than just metadata
    const lines = content.split('\n');
    const contentLines = lines.filter(line => 
      line.trim() && 
      !line.startsWith('#') &&
      !line.startsWith('**') &&
      !line.startsWith('---')
    );
    return contentLines.length > 5;
  } catch {
    return false;
  }
}

// ============================================================================
// Main Build Function
// ============================================================================

async function buildIndex(): Promise<void> {
  console.log('🔧 Building YC Knowledge Index v2...\n');
  
  // Paths - use workspace from environment or default
  const workspaceRoot = process.env.WORKSPACE_ROOT || '/Users/gongzhen/.openclaw/workspace';
  const sourceDir = path.join(workspaceRoot, 'skills', 'yc-advisor', 'references');
  const yamlPath = path.join(sourceDir, 'index.yaml');
  const outputDir = path.join(process.cwd(), 'data');
  const outputPath = path.join(outputDir, 'knowledge-index.json');
  
  console.log(`📁 Source: ${yamlPath}`);
  console.log(`📁 Output: ${outputPath}\n`);
  
  try {
    // Read YAML
    console.log('📖 Reading source index...');
    const yamlContent = await fs.readFile(yamlPath, 'utf-8');
    const yamlIndex = yaml.load(yamlContent) as YamlIndex;
    
    console.log(`✓ Found ${yamlIndex.total_resources} resources\n`);
    
    // Initialize index structure
    const index: KnowledgeIndex = {
      version: '2.0',
      generatedAt: new Date().toISOString(),
      stats: {
        totalResources: yamlIndex.total_resources,
        totalCategories: 0,
        totalLines: 0,
        totalAuthors: 0,
      },
      categories: {},
      resources: {},
      searchIndex: {
        byAuthor: {},
        byType: {},
        byStage: {},
        keywords: {},
      },
    };
    
    // Track unique values
    const uniqueCategories = new Set<string>();
    const uniqueAuthors = new Set<string>();
    
    // Process resources
    console.log('🔄 Processing resources...');
    
    for (const resource of yamlIndex.resources) {
      // Normalize topics to categories
      const normalizedTopics = resource.topics.map(normalizeCategory);
      
      // Check transcript
      const filePath = path.join(sourceDir, resource.file);
      const hasContent = await hasTranscript(filePath);
      
      // Add to resources
      index.resources[resource.code] = {
        code: resource.code,
        title: resource.title,
        author: resource.author,
        type: resource.type,
        url: resource.url,
        topics: normalizedTopics,
        founderStage: resource.founder_stage,
        lines: resource.lines,
        filePath: resource.file,
        hasTranscript: hasContent,
        related: resource.related || [],
      };
      
      // Update categories
      for (const topic of normalizedTopics) {
        uniqueCategories.add(topic);
        
        if (!index.categories[topic]) {
          index.categories[topic] = { count: 0, resources: [] };
        }
        index.categories[topic].count++;
        index.categories[topic].resources.push(resource.code);
      }
      
      // Update author index
      uniqueAuthors.add(resource.author);
      if (!index.searchIndex.byAuthor[resource.author]) {
        index.searchIndex.byAuthor[resource.author] = [];
      }
      index.searchIndex.byAuthor[resource.author].push(resource.code);
      
      // Update type index
      if (!index.searchIndex.byType[resource.type]) {
        index.searchIndex.byType[resource.type] = [];
      }
      index.searchIndex.byType[resource.type].push(resource.code);
      
      // Update stage index
      for (const stage of resource.founder_stage) {
        if (!index.searchIndex.byStage[stage]) {
          index.searchIndex.byStage[stage] = [];
        }
        index.searchIndex.byStage[stage].push(resource.code);
      }
      
      // Update stats
      index.stats.totalLines += resource.lines;
    }
    
    // Build keyword index
    console.log('🔤 Building keyword index...');
    index.searchIndex.keywords = buildKeywordIndex(yamlIndex.resources);
    
    // Update final stats
    index.stats.totalCategories = uniqueCategories.size;
    index.stats.totalAuthors = uniqueAuthors.size;
    
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });
    
    // Write JSON
    console.log('💾 Writing index...');
    await fs.writeFile(
      outputPath,
      JSON.stringify(index, null, 2),
      'utf-8'
    );
    
    // Print summary
    console.log('\n✅ Build complete!\n');
    console.log('📊 Statistics:');
    console.log(`   Total Resources: ${index.stats.totalResources}`);
    console.log(`   Total Categories: ${index.stats.totalCategories}`);
    console.log(`   Total Authors: ${index.stats.totalAuthors}`);
    console.log(`   Total Lines: ${index.stats.totalLines.toLocaleString()}`);
    console.log(`   Avg Lines/Resource: ${Math.round(index.stats.totalLines / index.stats.totalResources)}`);
    console.log(`   Keywords Indexed: ${Object.keys(index.searchIndex.keywords).length}`);
    
    console.log('\n📚 Top Categories:');
    const sortedCategories = Object.entries(index.categories)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);
    
    for (const [name, data] of sortedCategories) {
      console.log(`   ${name}: ${data.count} resources`);
    }
    
    console.log('\n👥 Top Authors:');
    const sortedAuthors = Object.entries(index.searchIndex.byAuthor)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 5);
    
    for (const [name, codes] of sortedAuthors) {
      console.log(`   ${name}: ${codes.length} resources`);
    }
    
  } catch (error) {
    console.error('\n❌ Build failed:', error);
    process.exit(1);
  }
}

// ============================================================================
// Run
// ============================================================================

if (require.main === module) {
  buildIndex();
}

export { buildIndex };
