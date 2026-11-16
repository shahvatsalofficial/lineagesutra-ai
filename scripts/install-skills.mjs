import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const base=path.resolve(here,'..');
const locations={claude:'.claude/skills',cursor:'.cursor/skills',codex:'.agents/skills',gemini:'.gemini/skills',copilot:'.github/skills',opencode:'.opencode/skills'};
export function installSkills({host,target}){
 if(!Object.hasOwn(locations,host))throw Error('Unsupported host; choose '+Object.keys(locations).join(', '));if(!target)throw Error('A target project is required');
 const root=fs.realpathSync(target);if(!fs.statSync(root).isDirectory())throw Error('Target must be directory');const rootOutput=path.join(root,locations[host]);const source=path.join(base,'skills');const files=fs.readdirSync(source,{withFileTypes:true}).filter(x=>x.isDirectory()&&!x.isSymbolicLink()).map(x=>x.name);
 const destParent=path.dirname(rootOutput);if(fs.existsSync(destParent)&&fs.realpathSync(destParent)!==root&&!fs.realpathSync(destParent).startsWith(root+path.sep))throw Error('Install path escapes target via symlink');
 if(fs.existsSync(rootOutput)&&fs.lstatSync(rootOutput).isSymbolicLink())throw Error('Install directory symlink rejected');
 const clash=files.find(x=>fs.existsSync(path.join(rootOutput,x)));if(clash)throw Error(`Skill exists; refusing overwrite: ${clash}`);
 fs.mkdirSync(rootOutput,{recursive:true});for(const s of files){const targetSkill=path.join(rootOutput,s);fs.cpSync(path.join(source,s),targetSkill,{recursive:true,errorOnExist:true,force:false,filter:src=>!fs.lstatSync(src).isSymbolicLink()});}
 return {host,count:files.length,installedTo:path.relative(root,rootOutput),status:'copied-only; native IDE activation NOT_TESTED'};
}
