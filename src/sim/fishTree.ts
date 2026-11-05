import { fishMarkKey, type FishMark } from './fishEvolution';
import { STARTER_FORMS, starterFormIndex, validStarterForm } from './starterFish';
export interface FishBranch { id:string; name:string; trace:FishMark[]; extinct?:boolean; archived?:boolean }
/** Only present players get live strands. Cached earlier connections remain quiet history, not extra players. */
export function fishTreeBranches(saved:readonly FishBranch[], own:FishBranch, peers:readonly FishBranch[]) {
  const live=[own,...peers.filter(b=>b.id!==own.id)];
  const ids=new Set(live.map(b=>b.id));
  const history=saved.filter(b=>!ids.has(b.id)&&(b.extinct||b.trace.length>1)).map(b=>({...b,archived:!b.extinct}));
  return [...live,...history];
}
export interface FishTreeNode {
  id:string; mark:FishMark; depth:number; x:number;
  children:FishTreeNode[]; branches:FishBranch[];
  /** Entire routes passing through this prefix; branches contains only the endpoints. */
  routes:FishBranch[];
  possible:boolean;
}

/** A visible milestone, respecting independent fins and the first weapon's exclusive higher tiers. */
export function fishSuccessors(mark:FishMark):FishMark[] {
  if(!validStarterForm(mark.form))return [];
  const stages=STARTER_FORMS[mark.form];
  const primary=mark.primary===1||mark.primary===3?mark.primary:stages[0]?1:stages[2]?3:0;
  return [0,1,2].flatMap(axis=>{
    const limit=axis===1||!primary||primary===axis+1?3:1;
    if(stages[axis]>=limit)return [];
    const next=[...stages];next[axis]++;
    return [{form:starterFormIndex(next),primary:primary|| (axis===1?0:axis+1)}];
  });
}

/** Shared prefixes retain exact ancestry. Optional grey twigs show legal alternatives, never invented player history. */
export function fishTree(branches:readonly FishBranch[], possibilities=false) {
  const nodes=new Map<string,FishTreeNode>();
  const roots:FishTreeNode[]=[];
  for(const branch of branches) {
    let parent:FishTreeNode|undefined;
    branch.trace.slice(0,8).forEach((mark,i)=>{
      const id=fishMarkKey(branch.trace.slice(0,i+1));
      let node=nodes.get(id);
      if(!validStarterForm(mark.form))return;
      if(!node){node={id,mark,depth:i,x:0,children:[],branches:[],routes:[],possible:false};nodes.set(id,node);if(parent)parent.children.push(node);else roots.push(node);}
      node.routes.push(branch);
      if(i===branch.trace.length-1)node.branches.push(branch);
      parent=node;
    });
  }
  if(possibilities) {
    if(!roots.length){const mark={form:0,primary:0},id=fishMarkKey([mark]);const root:FishTreeNode={id,mark,depth:0,x:0,children:[],branches:[],routes:[],possible:false};roots.push(root);nodes.set(id,root);}
    const observed=[...nodes.values()];
    const twig=(parent:FishTreeNode,mark:FishMark,axis:number,extend:boolean)=>{
      if(parent.depth>=7)return;
      const id=`${parent.id}/${mark.form}.${mark.primary}`;
      const node:FishTreeNode={id,mark,depth:parent.depth+1,x:0,children:[],branches:[],routes:[],possible:true};
      parent.children.push(node);nodes.set(id,node);
      // Unplayed tips suggest the rest of that trait's path, without expanding every permutation of 48 forms.
      if(extend){const next=fishSuccessors(mark).find(m=>STARTER_FORMS[m.form][axis]>STARTER_FORMS[mark.form][axis]);if(next)twig(node,next,axis,true);}
    };
    for(const node of observed){
      if(node.depth>0&&node.routes.every(branch=>branch.extinct||branch.archived))continue;
      const tip=!node.children.length;
      // Keep the fan readable: possibilities surround the origin and the newest steps, rather than widening every old step.
      const nearTip=node.children.some(child=>child.branches.some(branch=>!branch.extinct&&!branch.archived));
      if(node.depth>0&&!tip&&!nearTip)continue;
      for(const next of fishSuccessors(node.mark)){
        if(node.children.some(n=>n.mark.form===next.form&&n.mark.primary===next.primary))continue;
        const axis=STARTER_FORMS[next.form].findIndex((stage,i)=>stage>STARTER_FORMS[node.mark.form][i]);
        twig(node,next,axis,tip);
      }
    }
  }
  let lane=0;
  const position=(node:FishTreeNode)=>{
    node.children.sort((a,b)=>{
      const axis=(n:FishTreeNode)=>STARTER_FORMS[n.mark.form].findIndex((stage,i)=>stage>STARTER_FORMS[node.mark.form][i]);
      return axis(a)-axis(b);
    });
    node.children.forEach(position);
    node.x=node.children.length?node.children.reduce((sum,n)=>sum+n.x,0)/node.children.length:lane++*104;
  };
  roots.forEach(position);
  return {nodes:[...nodes.values()],roots,width:Math.max(104,lane*104)};
}
