/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: CORE.APP.COMPONENT.MAIN
   REGION: 🟢 CORE
   VERSION: 1.0.0
   ============================================================================
   LeeWayAuditSystem.ts
   
   DISCOVERY_PIPELINE:
     MODEL=Voice>Intent>Location>Vertical>Ranking>Render;
     ROLE=support;
     INTENT_SCOPE=n/a;
     LOCATION_DEP=none;
     VERTICALS=n/a;
     RENDER_SURFACE=in-app;
     SPEC_REF=LEEWAY.v12.DiscoveryArchitecture

   SPDX-License-Identifier: MIT
   ============================================================================ */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// LEEWAY Standards (from <repo>/LeeWayStandards)
// ============================================================================

const LEEWAY_REGIONS = [
  '🟢 CORE',
  '🔴 SEO',
  '🔵 UI',
  '🟣 MCP',
  '🧠 AI',
  '💾 DATA',
  '🟠 UTIL',
  '🟡 PY'
] as const;

const LEEWAY_DOMAINS = [
  'CORE', 'UI', 'DATA', 'AI', 'MCP',
  'SEO', 'ANALYTICS', 'SECURITY', 'PERF',
  'DOC', 'TOOLS', 'OPS'
] as const;

const LEEWAY_SUBDOMAINS: Record<string, string[]> = {
  CORE: ['APP', 'ROUTING', 'CONFIG', 'BOOT', 'ERROR'],
  UI: ['NAV', 'LAYOUT', 'COMPONENT', 'PUBLIC', 'THEME'],
  DATA: ['IDB', 'LOCAL', 'CACHE', 'SCHEMA'],
  AI: ['ORCHESTRATION', 'AGENT', 'MEMORY', 'RETRIEVAL'],
  MCP: ['RUNNER', 'REGISTRY', 'LOGS', 'UI'],
  SEO: ['DISCOVERY', 'META', 'SITEMAP', 'ROBOTS', 'OPENGRAPH', 'VOICE'],
  ANALYTICS: ['EVENTS', 'PROVIDER', 'PIPELINE', 'DASHBOARD'],
  SECURITY: ['AUTH', 'CONSENT', 'PERMISSIONS', 'SANITIZATION', 'POLICY'],
  PERF: ['BUDGET', 'LAZYLOAD', 'TELEMETRY', 'CACHE'],
  DOC: ['STANDARD', 'DIR'],
  TOOLS: ['LINTER', 'CLI', 'IDE'],
  OPS: ['CI', 'RELEASE', 'ENV', 'COMPLIANCE']
};

// ============================================================================
// File Type Handlers
// ============================================================================

interface FileTypeConfig {
  extensions: string[];
  commentStart: string;
  commentEnd: string;
  commentLine?: string;
}

const FILE_TYPES: FileTypeConfig[] = [
  {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.css'],
    commentStart: '/*',
    commentEnd: '*/',
  },
  {
    extensions: ['.html', '.md', '.xml'],
    commentStart: '<!--',
    commentEnd: '-->',
  },
  {
    extensions: ['.json'],
    commentStart: '',
    commentEnd: '',
  },
  {
    extensions: ['.ps1', '.sh'],
    commentStart: '',
    commentEnd: '',
    commentLine: '#'
  }
];

// ============================================================================
// Audit Result Types
// ============================================================================

interface AuditIssue {
  severity: 'error' | 'warning' | 'info';
  type: 'missing_header' | 'invalid_tag' | 'missing_region' | 'invalid_region' | 'missing_discovery';
  message: string;
  line?: number;
}

interface FileAuditResult {
  filePath: string;
  hasHeader: boolean;
  hasValidTag: boolean;
  hasValidRegion: boolean;
  hasDiscoveryPipeline: boolean;
  extractedTag?: string;
  extractedRegion?: string;
  issues: AuditIssue[];
  score: number; // 0-100
  canAutoFix: boolean;
}

interface ProjectAuditResult {
  files: FileAuditResult[];
  totalFiles: number;
  compliantFiles: number;
  complianceScore: number;
  summary: {
    missingHeaders: number;
    invalidTags: number;
    missingRegions: number;
    fixableFiles: number;
  };
}

// ============================================================================
// LEEWAY Header Parser
// ============================================================================

class LeeWayHeaderParser {
  /**
   * Check if file has LEEWAY header
   */
  hasHeader(content: string): boolean {
    return /LEEWAY\s+HEADER\s*—\s*DO\s+NOT\s+REMOVE/i.test(content);
  }

  /**
   * Extract TAG from header
   */
  extractTag(content: string): string | null {
    const match = content.match(/TAG:\s*([A-Z][A-Z0-9_.]*)/);
    return match ? match[1] : null;
  }

  /**
   * Extract REGION from header
   */
  extractRegion(content: string): string | null {
    const match = content.match(/REGION:\s*([🟢🔴🔵🟣🧠💾🟠🟡]\s*[A-Z]+)/);
    return match ? match[1] : null;
  }

  /**
   * Check if header has DISCOVERY_PIPELINE
   */
  hasDiscoveryPipeline(content: string): boolean {
    return /DISCOVERY_PIPELINE:/i.test(content);
  }

  /**
   * Validate TAG format (DOMAIN.SUBDOMAIN.ASSET.PURPOSE[.VARIANT])
   */
  validateTag(tag: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const parts = tag.split('.');

    if (parts.length < 4 || parts.length > 5) {
      errors.push(`TAG must have 4-5 parts, got ${parts.length}`);
      return { valid: false, errors };
    }

    const [domain, subdomain, asset, purpose, variant] = parts;

    // Validate domain
    if (!LEEWAY_DOMAINS.includes(domain as any)) {
      errors.push(`Invalid domain: ${domain}. Must be one of: ${LEEWAY_DOMAINS.join(', ')}`);
    }

    // Validate subdomain
    const validSubdomains = LEEWAY_SUBDOMAINS[domain] || [];
    if (!validSubdomains.includes(subdomain)) {
      errors.push(`Invalid subdomain: ${subdomain}. For ${domain}, must be one of: ${validSubdomains.join(', ')}`);
    }

    // Validate format (UPPERCASE_ONLY)
    const validFormat = /^[A-Z][A-Z0-9_]*$/;
    if (!validFormat.test(asset)) {
      errors.push(`Invalid asset format: ${asset}. Must be UPPERCASE with underscores only`);
    }
    if (!validFormat.test(purpose)) {
      errors.push(`Invalid purpose format: ${purpose}. Must be UPPERCASE with underscores only`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate REGION
   */
  validateRegion(region: string): boolean {
    return LEEWAY_REGIONS.some(r => region.includes(r));
  }
}

// ============================================================================
// LEEWAY Audit Engine
// ============================================================================

export class LeeWayAuditEngine {
  private parser = new LeeWayHeaderParser();
  private excludeDirs = ['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.cache'];
  private includeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.html', '.css', '.md', '.json'];

  /**
   * Audit entire project
   */
  async auditProject(rootDir: string): Promise<ProjectAuditResult> {
    console.log('🔍 Starting LEEWAY compliance audit...');
    console.log(`📂 Root: ${rootDir}`);

    const files = this.findFiles(rootDir);
    console.log(`📄 Found ${files.length} files to audit`);

    const results: FileAuditResult[] = [];

    for (const filePath of files) {
      const result = await this.auditFile(filePath, rootDir);
      results.push(result);
    }

    return this.calculateProjectScore(results);
  }

  /**
   * Audit single file
   */
  async auditFile(filePath: string, rootDir: string): Promise<FileAuditResult> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(rootDir, filePath);

    const issues: AuditIssue[] = [];
    let score = 100;

    // Check 1: Header presence
    const hasHeader = this.parser.hasHeader(content);
    if (!hasHeader) {
      issues.push({
        severity: 'error',
        type: 'missing_header',
        message: 'LEEWAY header is missing'
      });
      score -= 40;
    }

    // Check 2: TAG validation
    const tag = this.parser.extractTag(content);
    let hasValidTag = false;
    if (!tag) {
      issues.push({
        severity: 'error',
        type: 'invalid_tag',
        message: 'TAG is missing'
      });
      score -= 25;
    } else {
      const tagValidation = this.parser.validateTag(tag);
      hasValidTag = tagValidation.valid;
      if (!tagValidation.valid) {
        tagValidation.errors.forEach(err => {
          issues.push({
            severity: 'error',
            type: 'invalid_tag',
            message: err
          });
        });
        score -= 25;
      }
    }

    // Check 3: REGION validation
    const region = this.parser.extractRegion(content);
    let hasValidRegion = false;
    if (!region) {
      issues.push({
        severity: 'warning',
        type: 'missing_region',
        message: 'REGION is missing'
      });
      score -= 15;
    } else {
      hasValidRegion = this.parser.validateRegion(region);
      if (!hasValidRegion) {
        issues.push({
          severity: 'error',
          type: 'invalid_region',
          message: `Invalid REGION: ${region}`
        });
        score -= 15;
      }
    }

    // Check 4: DISCOVERY_PIPELINE
    const hasDiscoveryPipeline = this.parser.hasDiscoveryPipeline(content);
    if (!hasDiscoveryPipeline && this.shouldHaveDiscovery(filePath)) {
      issues.push({
        severity: 'info',
        type: 'missing_discovery',
        message: 'DISCOVERY_PIPELINE is recommended for this file type'
      });
      score -= 10;
    }

    return {
      filePath: relativePath,
      hasHeader,
      hasValidTag,
      hasValidRegion,
      hasDiscoveryPipeline,
      extractedTag: tag || undefined,
      extractedRegion: region || undefined,
      issues,
      score: Math.max(0, score),
      canAutoFix: !hasHeader || !hasValidTag || !hasValidRegion
    };
  }

  /**
   * Find all files to audit
   */
  private findFiles(dir: string, files: string[] = []): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!this.excludeDirs.includes(entry.name)) {
          this.findFiles(fullPath, files);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (this.includeExtensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  /**
   * Check if file should have DISCOVERY_PIPELINE
   */
  private shouldHaveDiscovery(filePath: string): boolean {
    const publicPatterns = [
      /pages?\//,
      /routes?\//,
      /public\//,
      /index\.(tsx?|jsx?|html)$/,
      /App\.(tsx?|jsx?)$/
    ];

    return publicPatterns.some(pattern => pattern.test(filePath));
  }

  /**
   * Calculate project-wide compliance score
   */
  private calculateProjectScore(results: FileAuditResult[]): ProjectAuditResult {
    const totalFiles = results.length;
    const compliantFiles = results.filter(r => r.score >= 85).length;
    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / totalFiles;

    const summary = {
      missingHeaders: results.filter(r => !r.hasHeader).length,
      invalidTags: results.filter(r => !r.hasValidTag).length,
      missingRegions: results.filter(r => !r.hasValidRegion).length,
      fixableFiles: results.filter(r => r.canAutoFix).length
    };

    return {
      files: results,
      totalFiles,
      compliantFiles,
      complianceScore: Math.round(avgScore),
      summary
    };
  }
}

// ============================================================================
// LEEWAY Header Generator
// ============================================================================

export class LeeWayHeaderGenerator {
  /**
   * Generate compliant LEEWAY header for a file
   */
  generateHeader(filePath: string, options: {
    tag?: string;
    region?: string;
    version?: string;
  } = {}): string {
    const ext = path.extname(filePath);
    const fileName = path.basename(filePath);
    const fileType = this.detectFileType(ext);

    // Infer TAG if not provided
    const tag = options.tag || this.inferTag(filePath);
    
    // Infer REGION if not provided
    const region = options.region || this.inferRegion(filePath);
    
    const version = options.version || '1.0.0';

    if (ext === '.json') {
      return this.generateJsonHeader(tag, region, version);
    }

    const { commentStart, commentEnd } = fileType;

    return `${commentStart} ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: ${tag}
   REGION: ${region}
   VERSION: ${version}
   ============================================================================
   ${fileName}
   
   DISCOVERY_PIPELINE:
     MODEL=Voice>Intent>Location>Vertical>Ranking>Render;
     ROLE=support;
     INTENT_SCOPE=n/a;
     LOCATION_DEP=none;
     VERTICALS=n/a;
     RENDER_SURFACE=in-app;
     SPEC_REF=LEEWAY.v12.DiscoveryArchitecture

   SPDX-License-Identifier: MIT
   ============================================================================ ${commentEnd}

`;
  }

  /**
   * Generate JSON-compatible header
   */
  private generateJsonHeader(tag: string, region: string, version: string): string {
    return `{
  "_LEEWAY_HEADER": {
    "PROFILE": "LEEWAY-ORDER",
    "TAG": "${tag}",
    "REGION": "${region}",
    "VERSION": "${version}",
    "DISCOVERY_PIPELINE": {
      "MODEL": "Voice>Intent>Location>Vertical>Ranking>Render",
      "ROLE": "support",
      "INTENT_SCOPE": "n/a",
      "LOCATION_DEP": "none",
      "VERTICALS": "n/a",
      "RENDER_SURFACE": "n/a",
      "SPEC_REF": "LEEWAY.v12.DiscoveryArchitecture"
    }
  },
`;
  }

  /**
   * Infer TAG from file path
   */
  private inferTag(filePath: string): string {
    const normalized = filePath.toLowerCase();
    
    // Component patterns
    if (normalized.includes('/components/') || normalized.endsWith('.tsx')) {
      const name = path.basename(filePath, path.extname(filePath));
      return `UI.COMPONENT.${name.toUpperCase()}.MAIN`;
    }
    
    // Page patterns
    if (normalized.includes('/pages/') || normalized.includes('/routes/')) {
      const name = path.basename(filePath, path.extname(filePath));
      return `UI.PUBLIC.PAGE.${name.toUpperCase()}`;
    }
    
    // AI/Model patterns
    if (normalized.includes('model') || normalized.includes('ai/')) {
      return 'AI.ORCHESTRATION.MODEL.LOADER';
    }
    
    // Data patterns
    if (normalized.includes('data/') || normalized.includes('store')) {
      return 'DATA.LOCAL.STORE.MAIN';
    }
    
    // Config patterns
    if (normalized.includes('config')) {
      return 'CORE.CONFIG.RUNTIME.ENV';
    }
    
    // Default
    return 'CORE.APP.COMPONENT.MAIN';
  }

  /**
   * Infer REGION from file path
   */
  private inferRegion(filePath: string): string {
    const normalized = filePath.toLowerCase();
    
    if (normalized.includes('/ui/') || normalized.includes('/components/')) return '🔵 UI';
    if (normalized.includes('/ai/') || normalized.includes('/model')) return '🧠 AI';
    if (normalized.includes('/data/') || normalized.includes('/store')) return '💾 DATA';
    if (normalized.includes('/seo/')) return '🔴 SEO';
    if (normalized.includes('/mcp/')) return '🟣 MCP';
    if (normalized.includes('/tools/') || normalized.includes('/scripts/')) return '🟠 UTIL';
    if (normalized.includes('/core/') || normalized.includes('/config/')) return '🟢 CORE';
    
    return '🟢 CORE';
  }

  /**
   * Detect file type config
   */
  private detectFileType(ext: string): FileTypeConfig {
    return FILE_TYPES.find(ft => ft.extensions.includes(ext)) || FILE_TYPES[0];
  }
}

// ============================================================================
// Export Main API
// ============================================================================

export const auditEngine = new LeeWayAuditEngine();
export const headerGenerator = new LeeWayHeaderGenerator();
