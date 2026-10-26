import fs from 'fs';

const filePath = 'src/components/fx/AgentProductDemo.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const target = `: msg.flowJournal,\r\n                                          }`;
const replacement = `: msg.flowJournal,\r\n                                            hitl:\r\n                                              next.run.status === "finish" && !msg.hitl\r\n                                                ? {\r\n                                                    id: \`tkt-\${m.id.replace(/[^a-zA-Z0-9]/g, "").slice(-6)}\`,\r\n                                                    action: "mcp::financial_settle_commit",\r\n                                                    title: "核算台账写入正式结算流水 (财务总账落库)",\r\n                                                    status: "draft",\r\n                                                    createdAt: Date.now(),\r\n                                                  }\r\n                                                : msg.hitl,\r\n                                          }`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('PATCHED_SUCCESSFULLY');
} else {
  console.error('TARGET_NOT_FOUND');
  process.exit(1);
}
