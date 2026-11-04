import { fishMarkKey, type FishMark } from './fishEvolution';
export interface FishBranch { id:string; name:string; trace:FishMark[]; extinct?:boolean }
export interface FishTreeNode { id:string; mark:FishMark; depth:number; x:number; children:FishTreeNode[]; branches:FishBranch[] }
/** Only observed prefixes exist. Sharing an egg shares its exact ancestry, not the adopter's old branch. */
export function fishTree(branches:readonly FishBranch[]) {
  const nodes=new Map<string,FishTreeNode>();
  const roots:FishTreeNode[]=[];
  for(const branch of branches) {
    let parent:FishTreeNode|undefined;
    branch.trace.slice(0,8).forEach((mark,i)=>{
      const id=fishMarkKey(branch.trace.slice(0,i+1));
      let node=nodes.get(id);
      if(!node){node={id,mark,depth:i,x:0,children:[],branches:[]};nodes.set(id,node);if(parent)parent.children.push(node);else roots.push(node);}
      if(i===branch.trace.length-1)node.branches.push(branch);
      parent=node;
    });
  }
  let lane=0;
  const position=(node:FishTreeNode)=>{
    node.children.forEach(position);
    node.x=node.children.length?node.children.reduce((sum,n)=>sum+n.x,0)/node.children.length:lane++*156;
  };
  roots.forEach(position);
  return {nodes:[...nodes.values()],width:Math.max(156,lane*156)};
}
