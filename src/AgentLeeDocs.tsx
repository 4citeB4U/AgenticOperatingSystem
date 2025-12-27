/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: UI.COMPONENT.AGENTLEEDOCS.MAIN
   REGION: 🟢 CORE
   VERSION: 1.0.0
   ============================================================================
   AgentLeeDocs.tsx
   
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

import { AlertCircle, BookOpen, Calendar, ChevronRight, Database, Home, Mail, Phone, Shield, Wrench, X } from 'lucide-react';
import { useState } from 'react';

type SectionId = 'overview' | 'memory-lake' | 'leemail' | 'communications' | 'tools' | 'security' | 'playbook' | 'faq';
type AgentLeeDocsProps = {
  isOpen?: boolean;
  setIsOpen?: (v: boolean) => void;
};

export default function AgentLeeDocs({ isOpen: controlledIsOpen, setIsOpen: controlledSetIsOpen }: AgentLeeDocsProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof controlledIsOpen === 'boolean' && typeof controlledSetIsOpen === 'function';
  const isOpen = isControlled ? controlledIsOpen! : internalOpen;
  const setIsOpen = (v: boolean) => {
    if (isControlled) controlledSetIsOpen!(v); else setInternalOpen(v);
  };
  const [activeSection, setActiveSection] = useState<SectionId>('overview');

  const sections = [
    { id: 'overview', icon: Home, label: 'Overview', color: 'bg-blue-500' },
    { id: 'memory-lake', icon: Database, label: 'Memory Lake', color: 'bg-purple-500' },
    { id: 'leemail', icon: Mail, label: 'LeeMail', color: 'bg-green-500' },
    { id: 'communications', icon: Phone, label: 'Communications', color: 'bg-orange-500' },
    { id: 'tools', icon: Wrench, label: 'Tools', color: 'bg-yellow-500' },
    { id: 'security', icon: Shield, label: 'Security', color: 'bg-red-500' },
    { id: 'playbook', icon: Calendar, label: 'Operator Playbook', color: 'bg-indigo-500' },
    { id: 'faq', icon: AlertCircle, label: 'FAQ', color: 'bg-gray-500' }
  ];

  const content = {
    overview: {
      title: 'Agent Lee: Agentic Operating System',
      sections: [
        {
          heading: 'What is Agent Lee?',
          content: 'Agent Lee is a local-first, policy-governed operating partner that reads and writes a structured, searchable, auditable Memory Lake—and then uses that Lake to run mail, communications, notes, tasks, and research as one connected workflow.'
        },
        {
          heading: 'Key Principles',
          items: [
            'Runs entirely in your browser (no cloud, no backends)',
            'Powered by WebGPU for fast local AI processing',
            'Zero-Egress by default (network access blocked unless you enable it)',
            'All data stored in the Memory Lake (your local vault)',
            'Evidence-based: every action creates auditable artifacts'
          ]
        },
        {
          heading: 'The Five Organs',
          items: [
            'Memory Lake: Multi-drive file system and evidence vault',
            'LeeMail: Email intake, summarization, and task extraction',
            'Communications: Phone, messages, video, contacts, notes',
            'Policy & Settings: Zero-Egress defaults and capability gates',
            'Style Core: Consistent, operator-friendly interface'
          ]
        }
      ]
    },
    'memory-lake': {
      title: 'Memory Lake System',
      sections: [
        {
          heading: 'What is the Memory Lake?',
          content: 'The Memory Lake is not a chat transcript dump. It is the system\'s durable state and evidence layer. When any module produces intelligence—an email summary, a call note, a task list—the system writes a structured artifact into the Lake.'
        },
        {
          heading: 'The 64GB Strategy',
          content: 'The Lake is organized as 8 drives (L, E, O, N, A, R, D, LEE). Each drive has 8 slots. Each slot is 1GB of storage. Total capacity: 8 × 8 × 1GB = 64GB of addressable Lake capacity.'
        },
        {
          heading: 'Drive Purposes',
          items: [
            'L: Learning, training data, mistake logs',
            'E: Email, communications evidence',
            'O: Operations, tasks, workflows',
            'N: Notes, documentation, quick captures',
            'A: Artifacts, media, attachments',
            'R: Research, analysis, intelligence',
            'D: Data, compliance, audit trails',
            'LEE: Coordination drive (master index)'
          ]
        },
        {
          heading: 'Color-Coded Health',
          items: [
            '🟢 Normal: Healthy, trusted',
            '🟡 Suspect: Flagged for review',
            '🟠 Quarantined: Isolated, cannot interact',
            '🔴 Blocked: Corrupt, pending deletion'
          ]
        },
        {
          heading: 'Link-File Strategy',
          content: 'Keep the Lake lean by saving large collections in 1GB container files on your device. Agent Lee references these files and treats them as native capacity without consuming internal Lake quota.'
        }
      ]
    },
    leemail: {
      title: 'LeeMail / Email Center',
      sections: [
        {
          heading: 'Email as Intake',
          content: 'LeeMail is not just an inbox—it\'s an intake organ. It turns email streams into actionable intelligence and permanent evidence.'
        },
        {
          heading: 'Key Features',
          items: [
            'Summarize unread email streams',
            'Extract action items automatically',
            'Archive all interactions as Lake artifacts',
            'Track sent messages with full audit trail',
            'Process attachments with preview and download',
            'Re-process historical emails for new insights'
          ]
        },
        {
          heading: 'Artifact Flow',
          items: [
            'Unread summaries → agent/summaries/',
            'Interaction traces → agent/interactions/',
            'Sent messages → leemail/sent/',
            'Extracted tasks → leemail/tasks/',
            'Attachments → leemail/attachments/'
          ]
        },
        {
          heading: 'Email Safety',
          items: [
            'Suspicious content automatically segregated',
            'Tasks from risky mail are flagged',
            'Attachments not automatically trusted',
            'Full audit trail in the Lake'
          ]
        }
      ]
    },
    communications: {
      title: 'Communications Outlet',
      sections: [
        {
          heading: 'Unified Handset',
          content: 'Phone, Messages, Video, and Contacts share one shell so the OS treats them as one continuous workflow.'
        },
        {
          heading: 'Four Tabs',
          items: [
            'Phone: Voice calls with transcript logging',
            'Messages: SMS/chat with automatic note generation',
            'Video: Face-to-face calls with screen sharing',
            'Contacts: Unified contact management'
          ]
        },
        {
          heading: 'Quick Notes',
          content: 'Part of the communications loop: a call or message can immediately become a note, that note can become a task, that task can become a scheduled action—every step becomes a Lake artifact.'
        },
        {
          heading: 'File Sharing',
          items: [
            'Upload images, videos, docs',
            'Preview during video calls',
            'Store into Lake for later retrieval',
            'Never held hostage by cloud services'
          ]
        },
        {
          heading: 'Permissions',
          content: 'Requests default handler + contacts + media access (camera/mic) so calls and FaceTime-like features work properly.'
        }
      ]
    },
    tools: {
      title: 'Tools & Capabilities',
      sections: [
        {
          heading: 'Gated Capabilities',
          content: 'Tools are how Agent Lee acts—not just talks. Tools are gated capabilities that produce artifacts.'
        },
        {
          heading: 'Voice',
          items: [
            'Accept microphone input',
            'Deliver spoken output',
            'Transcripts saved as Lake artifacts',
            'Full continuity across sessions'
          ]
        },
        {
          heading: 'Vision',
          items: [
            'Capture camera feed into images',
            'Analyze and describe frames',
            'Store frames for later retrieval',
            'Pull exact frames back up on demand'
          ]
        },
        {
          heading: 'Research',
          items: [
            'Acts as research agent when policy allows',
            'Default: Zero-Egress blocks remote calls',
            'Must explicitly override to enable network',
            'All research saved as Lake artifacts'
          ]
        },
        {
          heading: 'Image Generation',
          items: [
            'Generate images when enabled',
            'Treated as deliverables',
            'Saved, re-openable, exportable',
            'Attachable to mail, notes, or projects'
          ]
        }
      ]
    },
    security: {
      title: 'Security & Zero-Egress',
      sections: [
        {
          heading: 'Policy-First Security',
          content: 'The default profile is Zero-Egress: remote calls are blocked unless you explicitly turn them on. The system is safe by default and only becomes networked by conscious choice.'
        },
        {
          heading: 'What Zero-Egress Blocks',
          items: [
            'Remote LLM/embedding/TTS API calls',
            'Network research mode',
            'Cloud sync services',
            'Unauthorized data transmission'
          ]
        },
        {
          heading: 'Sensor Permissions',
          items: [
            'Camera requires explicit policy approval',
            'Microphone requires explicit policy approval',
            'If blocked, UI closes instead of silent capture',
            'No surprise data collection'
          ]
        },
        {
          heading: 'Corruption Defense',
          content: 'Agent Lee can scan for corrupt artifacts, isolate them, and delete them. If corruption spreads, it\'s treated as a containment event: identify lineage, cut links, purge copies, write incident report.'
        },
        {
          heading: 'Security Operations',
          items: [
            'Signatures + timestamps on all artifacts',
            'Lineage tracking for audit trails',
            'Quarantine suspicious content',
            'Verify integrity regularly',
            'Document all containment events'
          ]
        }
      ]
    },
    playbook: {
      title: 'Operator Playbook',
      sections: [
        {
          heading: 'Daily Routine',
          items: [
            'Summarize unread mail',
            'Log summary to Lake',
            'Extract and prioritize tasks',
            'Review task queue',
            'Mark task completions'
          ]
        },
        {
          heading: 'Weekly Routine',
          items: [
            'Export Lake shards',
            'Export link-file containers',
            'Review quarantined items',
            'Clean up completed tasks'
          ]
        },
        {
          heading: 'Monthly Routine',
          items: [
            'Run full integrity scans',
            'Purge trash and stale caches',
            'Verify backups restore cleanly',
            'Review and update policies'
          ]
        },
        {
          heading: 'Saving Strategy',
          content: 'Browsers can clear storage, so exports are not optional—they are survival. Schedule regular exports and treat them like backups.'
        },
        {
          heading: 'Use Drives Intentionally',
          items: [
            'Keep LEE drive clean and authoritative',
            'Don\'t mix high-risk artifacts into trusted drives',
            'Mark suspect items immediately',
            'Use link-files for large collections'
          ]
        },
        {
          heading: 'Handle Corruption',
          content: 'Never ignore corruption warnings. Trigger scan → isolate branch → purge bad lineage → write incident report. That incident becomes future defense.'
        },
        {
          heading: 'Always',
          content: 'Keep Zero-Egress ON unless actively running a trusted remote workflow.'
        }
      ]
    },
    faq: {
      title: 'FAQ & Troubleshooting',
      sections: [
        {
          heading: 'What makes Agent Lee different?',
          content: 'Agent Lee runs entirely in your browser. No cloud, no API keys, no subscriptions. Your data never leaves your device unless you explicitly export it.'
        },
        {
          heading: 'What is Zero-Egress?',
          content: 'Zero-Egress is a security policy that blocks all network calls by default. Agent Lee only connects to the internet when you explicitly enable it for specific tasks like research.'
        },
        {
          heading: 'Can I lose my data?',
          content: 'Browsers can clear storage, so regular exports are critical. Use the export feature weekly to create backup shards of your Memory Lake.'
        },
        {
          heading: 'What is RAG?',
          content: 'Retrieval-Augmented Generation (RAG) means Agent Lee retrieves relevant artifacts from the Memory Lake before responding, providing evidence-based answers instead of hallucinations.'
        },
        {
          heading: 'How do link-files work?',
          content: 'Link-files let you store large collections (like photos or videos) in 1GB containers outside the Lake. Agent Lee indexes them so you can search and retrieve without bloating internal storage.'
        },
        {
          heading: 'What if I see a corrupt artifact?',
          content: 'Don\'t ignore it. Go to Settings → Integrity Scan, select the drive, and run a scan. Agent Lee will isolate and quarantine corrupt files automatically.'
        },
        {
          heading: 'Can I use Agent Lee offline?',
          content: 'Yes! Agent Lee works completely offline by default. That\'s the whole point of Zero-Egress and local-first architecture.'
        },
        {
          heading: 'What are the system requirements?',
          content: 'WebGPU-capable browser (Chrome 113+, Edge 113+), 8GB RAM minimum, GPU with 4GB+ VRAM recommended for best performance.'
        }
      ]
    }
  };

  type Section = {
    heading: string;
    content?: string;
    items?: string[];
  };

  type ContentType = {
    [key: string]: {
      title: string;
      sections: Section[];
    };
  };

  const renderContent = (section: SectionId) => {
    const data = content[section];
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-6">{data.title}</h2>
        {data.sections.map((sec: Section, idx: number) => (
          <div key={idx} className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-3">{sec.heading}</h3>
            {sec.content && <p className="text-gray-700 leading-relaxed mb-3">{sec.content}</p>}
            {sec.items && (
              <ul className="space-y-2">
                {sec.items.map((item: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-gray-700">
                    <ChevronRight className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      {/* Documentation Panel (controlled by parent or internal state) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Panel */}
          <div className="relative ml-auto w-full max-w-5xl bg-white shadow-2xl flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BookOpen className="w-8 h-8" />
                <div>
                  <h1 className="text-2xl font-bold">Agent Lee Documentation</h1>
                  <p className="text-blue-100 text-sm">v38.0 | Agentic Operating System</p>
                </div>
              </div>
                        <button
                          onClick={() => setIsOpen(false)}
                          className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                          title="Close Documentation"
                          aria-label="Close Documentation"
                        >
                          <X className="w-6 h-6" />
                        </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Sidebar Navigation */}
              <nav className="w-64 bg-gray-50 border-r border-gray-200 overflow-y-auto p-4">
                <div className="space-y-1">
                  {sections.map((section) => {
                    const Icon = section.icon;
                    return (
                      <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id as SectionId)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                          activeSection === section.id
                            ? 'bg-blue-100 text-blue-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <div className={`${section.color} p-2 rounded-lg`}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-left">{section.label}</span>
                      </button>
                    );
                  })}
                </div>
              </nav>

              {/* Content Area */}
              <main className="flex-1 overflow-y-auto p-8">
                {renderContent(activeSection)}
              </main>
            </div>

            {/* Footer */}
            <div className="bg-gray-100 border-t border-gray-200 px-6 py-3 flex items-center justify-between text-sm text-gray-600">
              <div>
                <span className="font-semibold">Status:</span> ONLINE | 
                <span className="font-semibold"> Governance:</span> Zero-Egress (Strict)
              </div>
              <div className="text-gray-500">
                © 2025 Leeway Industries
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
