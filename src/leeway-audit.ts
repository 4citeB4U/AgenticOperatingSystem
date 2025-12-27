/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: CORE.APP.COMPONENT.MAIN
   REGION: 🟢 CORE
   VERSION: 1.0.0
   ============================================================================
   leeway-audit.ts
   
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
import { auditEngine, headerGenerator } from './LeeWayAuditSystem';

// ============================================================================
// CLI Arguments
// ============================================================================

interface CLIOptions {
  fix: boolean;
  report: boolean;
  dir: string;
  verbose: boolean;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  
  return {
    fix: args.includes('--fix'),
    report: args.includes('--report'),
    dir: process.cwd(),
    verbose: args.includes('--verbose') || args.includes('-v')
  };
}

// ============================================================================
// Report Generators
// ============================================================================

function printSummary(result: any) {
  const { totalFiles, compliantFiles, complianceScore, summary } = result;
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 LEEWAY COMPLIANCE REPORT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Overall Score
  const scoreColor = complianceScore >= 85 ? '🟢' : complianceScore >= 70 ? '🟡' : '🔴';
  console.log(`${scoreColor} Overall Compliance Score: ${complianceScore}/100`);
  console.log(`📄 Files Audited: ${totalFiles}`);
  console.log(`✅ Compliant Files: ${compliantFiles} (${Math.round(compliantFiles/totalFiles*100)}%)`);
  console.log(`❌ Non-Compliant: ${totalFiles - compliantFiles}\n`);
  
  // Issue Breakdown
  console.log('Issues Found:');
  console.log(`  🔴 Missing Headers: ${summary.missingHeaders}`);
  console.log(`  🔴 Invalid TAGs: ${summary.invalidTags}`);
  console.log(`  🟡 Missing REGIONs: ${summary.missingRegions}`);
  console.log(`  🔧 Auto-Fixable: ${summary.fixableFiles}\n`);
  
  // Grade
  const grade = complianceScore >= 95 ? 'GOLD ✨' : 
                complianceScore >= 85 ? 'SILVER 🥈' : 
                complianceScore >= 70 ? 'BRONZE 🥉' : 
                'NON-COMPLIANT ❌';
  
  console.log(`Grade: ${grade}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

function printDetailedReport(result: any) {
  const nonCompliantFiles = result.files
    .filter((f: any) => f.score < 85)
    .sort((a: any, b: any) => a.score - b.score);
  
  if (nonCompliantFiles.length === 0) {
    console.log('✅ All files are compliant! 🎉\n');
    return;
  }
  
  console.log('📋 Non-Compliant Files:\n');
  
  nonCompliantFiles.forEach((file: any) => {
    const scoreColor = file.score >= 70 ? '🟡' : '🔴';
    console.log(`${scoreColor} ${file.filePath} (${file.score}/100)`);
    
    file.issues.forEach((issue: any) => {
      const icon = issue.severity === 'error' ? '  ❌' : 
                   issue.severity === 'warning' ? '  ⚠️' : '  ℹ️';
      console.log(`${icon} ${issue.message}`);
    });
    
    if (file.canAutoFix) {
      console.log('  🔧 Can be auto-fixed with --fix flag');
    }
    
    console.log('');
  });
}

function generateMarkdownReport(result: any, outputPath: string) {
  const { totalFiles, compliantFiles, complianceScore, summary, files } = result;
  
  let md = `# LEEWAY Compliance Report\n\n`;
  md += `**Generated:** ${new Date().toISOString()}\n\n`;
  md += `## Summary\n\n`;
  md += `- **Overall Score:** ${complianceScore}/100\n`;
  md += `- **Files Audited:** ${totalFiles}\n`;
  md += `- **Compliant Files:** ${compliantFiles} (${Math.round(compliantFiles/totalFiles*100)}%)\n\n`;
  
  md += `### Issues\n\n`;
  md += `- Missing Headers: ${summary.missingHeaders}\n`;
  md += `- Invalid TAGs: ${summary.invalidTags}\n`;
  md += `- Missing REGIONs: ${summary.missingRegions}\n`;
  md += `- Auto-Fixable: ${summary.fixableFiles}\n\n`;
  
  md += `## Non-Compliant Files\n\n`;
  
  const nonCompliant = files.filter((f: any) => f.score < 85);
  nonCompliant.forEach((file: any) => {
    md += `### ${file.filePath} (${file.score}/100)\n\n`;
    
    if (file.issues.length > 0) {
      md += `**Issues:**\n\n`;
      file.issues.forEach((issue: any) => {
        md += `- **[${issue.severity.toUpperCase()}]** ${issue.message}\n`;
      });
      md += `\n`;
    }
    
    if (file.canAutoFix) {
      md += `✅ Can be auto-fixed\n\n`;
    }
  });
  
  fs.writeFileSync(outputPath, md);
  console.log(`📄 Detailed report saved to: ${outputPath}\n`);
}

// ============================================================================
// Auto-Fix Engine
// ============================================================================

async function autoFixFile(filePath: string, rootDir: string) {
  const fullPath = path.join(rootDir, filePath);
  const content = fs.readFileSync(fullPath, 'utf-8');
  
  // Generate header
  const header = headerGenerator.generateHeader(filePath);
  
  // Check if file already has ANY header (even invalid)
  const hasAnyHeader = /LEEWAY\s+HEADER/i.test(content);
  
  let newContent: string;
  
  if (hasAnyHeader) {
    // Replace existing header
    const headerEnd = content.indexOf('============================================================================ */') + 
                      '============================================================================ */'.length;
    if (headerEnd > 0) {
      newContent = header + content.substring(headerEnd).trimStart();
    } else {
      // HTML/MD style
      const htmlEnd = content.indexOf('========================================================================== -->') + 
                      '========================================================================== -->'.length;
      if (htmlEnd > 0) {
        newContent = header + content.substring(htmlEnd).trimStart();
      } else {
        // Fallback: prepend
        newContent = header + '\n' + content;
      }
    }
  } else {
    // Prepend new header
    newContent = header + content;
  }
  
  // Write back
  fs.writeFileSync(fullPath, newContent);
  console.log(`  ✅ Fixed: ${filePath}`);
}

// ============================================================================
// Main CLI
// ============================================================================

async function main() {
  const options = parseArgs();
  
  console.log('🔍 LEEWAY Compliance Audit');
  console.log(`📂 Directory: ${options.dir}\n`);
  
  // Run audit
  console.log('Scanning files...\n');
  const result = await auditEngine.auditProject(options.dir);
  
  // Print summary
  printSummary(result);
  
  // Detailed report
  if (options.report) {
    printDetailedReport(result);
    
    // Generate markdown report
    const reportPath = path.join(options.dir, 'LEEWAY_COMPLIANCE_REPORT.md');
    generateMarkdownReport(result, reportPath);
  }
  
  // Auto-fix
  if (options.fix) {
    console.log('🔧 Auto-fixing non-compliant files...\n');
    
    const fixableFiles = result.files.filter(f => f.canAutoFix);
    
    if (fixableFiles.length === 0) {
      console.log('ℹ️  No auto-fixable files found.\n');
    } else {
      console.log(`Found ${fixableFiles.length} files to fix:\n`);
      
      for (const file of fixableFiles) {
        await autoFixFile(file.filePath, options.dir);
      }
      
      console.log(`\n✅ Fixed ${fixableFiles.length} files!`);
      console.log('💡 Run audit again to verify fixes.\n');
    }
  } else if (result.summary.fixableFiles > 0) {
    console.log(`💡 Tip: Run with --fix to auto-correct ${result.summary.fixableFiles} files\n`);
  }
  
  // Exit code
  process.exit(result.complianceScore >= 70 ? 0 : 1);
}

// ============================================================================
// Run
// ============================================================================

main().catch(err => {
  console.error('❌ Audit failed:', err);
  process.exit(1);
});