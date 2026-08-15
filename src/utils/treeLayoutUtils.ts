import type { LocationWithStats, SublocationWithStats, PositionWithStats, LocationBoxWithStats, ItemFolderWithStats } from '../types/database';
import type { BoxType } from '../services/boxService';

export type TreeNodeType = 'location' | 'sublocation' | 'position' | 'box' | 'folder';

export interface TreeNode {
  id: string;
  type: TreeNodeType;
  name: string;
  iconId: string | null;
  accentColor: string | null;
  boxType?: BoxType;
  children: TreeNode[];
  depth: number;
  column: number;
  childCount: number;
  isGhost?: boolean;
  utilizationPercent?: number;
  totalCells?: number;
  occupiedCells?: number;
  itemCount?: number;
  locationId?: string;
  sublocationId?: string;
  sublocationName?: string;
  sublocationAccentColor?: string | null;
  sublocationLocationType?: string;
  sublocationIconId?: string | null;
  positionLocationType?: string;
  locationType?: string;
}

export interface PositionedNode {
  node: TreeNode;
  x: number;
  y: number;
  width: number;
  height: number;
  parentId?: string;
  parentX?: number;
  parentY?: number;
  parentAccentColor?: string | null;
}

export interface ColumnDef {
  label: string;
  color: string;
  width: number;
}

const ALL_COLUMN_DEFS: Record<string, ColumnDef> = {
  location: { label: 'Locations', color: '#3b82f6', width: 210 },
  sublocation: { label: 'Sub-locations', color: '#06b6d4', width: 175 },
  position: { label: 'Positions', color: '#6b7280', width: 150 },
  boxfolder: { label: 'Boxes & Sheets', color: '#f59e0b', width: 140 },
};

const NODE_HEIGHT = 36;
const NODE_HEIGHT_LOCATION = 46;
const NODE_HEIGHT_SUBLOCATION = 40;
const COLUMN_GAP = 80;
const VERTICAL_GAP = 10;
const HEADER_HEIGHT = 32;

export const TREE_VERTICAL_GAP = 48;

export function getNodeHeight(type: string): number {
  if (type === 'location') return NODE_HEIGHT_LOCATION;
  if (type === 'sublocation') return NODE_HEIGHT_SUBLOCATION;
  return NODE_HEIGHT;
}

export interface ActiveColumns {
  defs: ColumnDef[];
  positions: number[];
  totalWidth: number;
  columnIndexMap: { location: number; sublocation: number; position: number; boxfolder: number };
}

export function computeActiveColumns(hasSubs: boolean, hasPositions: boolean, hasBoxFolders: boolean): ActiveColumns {
  const keys: string[] = ['location'];
  if (hasSubs) keys.push('sublocation');
  if (hasPositions) keys.push('position');
  if (hasBoxFolders) keys.push('boxfolder');

  const defs = keys.map(k => ALL_COLUMN_DEFS[k]);
  const positions: number[] = [];
  let x = 0;
  for (let i = 0; i < defs.length; i++) {
    positions.push(x);
    x += defs[i].width + COLUMN_GAP;
  }
  const totalWidth = positions.length > 0
    ? positions[positions.length - 1] + defs[defs.length - 1].width
    : 0;

  const columnIndexMap = {
    location: 0,
    sublocation: keys.indexOf('sublocation'),
    position: keys.indexOf('position'),
    boxfolder: keys.indexOf('boxfolder'),
  };

  return { defs, positions, totalWidth, columnIndexMap };
}

export function computeTreeLayout(root: TreeNode, activeColumns: ActiveColumns): PositionedNode[] {
  const yOffsetStart = HEADER_HEIGHT + 12;
  const positioned: PositionedNode[] = [];

  function measureSubtreeHeight(node: TreeNode): number {
    const nh = getNodeHeight(node.type);
    if (node.children.length === 0) return nh;
    let total = 0;
    for (let i = 0; i < node.children.length; i++) {
      total += measureSubtreeHeight(node.children[i]);
      if (i < node.children.length - 1) total += VERTICAL_GAP;
    }
    return Math.max(nh, total);
  }

  function positionSubtree(node: TreeNode, yStart: number, parentId: string | null, parentAccentColor: string | null) {
    const col = node.column;
    const x = activeColumns.positions[col] ?? 0;
    const width = activeColumns.defs[col]?.width ?? 140;
    const nh = getNodeHeight(node.type);
    const subtreeHeight = measureSubtreeHeight(node);
    const nodeY = yStart + (subtreeHeight - nh) / 2;

    const nodePositions = positionMap;
    nodePositions.set(node.id, { x, y: nodeY, width, height: nh });

    let parentX: number | undefined;
    let parentY: number | undefined;
    let parentAC: string | null | undefined;

    if (parentId) {
      const parentPos = nodePositions.get(parentId);
      if (parentPos) {
        parentX = parentPos.x + parentPos.width;
        parentY = parentPos.y + parentPos.height / 2;
        parentAC = parentAccentColor;
      }
    }

    positioned.push({
      node,
      x,
      y: nodeY,
      width,
      height: nh,
      parentId: parentId || undefined,
      parentX,
      parentY,
      parentAccentColor: parentAC,
    });

    if (node.children.length === 0) return;

    let childY = yStart;
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      positionSubtree(child, childY, node.id, node.accentColor);
      childY += measureSubtreeHeight(child);
      if (i < node.children.length - 1) childY += VERTICAL_GAP;
    }
  }

  const positionMap = new Map<string, { x: number; y: number; width: number; height: number }>();
  positionSubtree(root, yOffsetStart, null, null);

  return positioned;
}

export function computeTreeHeight(root: TreeNode): number {
  function measureSubtreeHeight(node: TreeNode): number {
    const nh = getNodeHeight(node.type);
    if (node.children.length === 0) return nh;
    let total = 0;
    for (let i = 0; i < node.children.length; i++) {
      total += measureSubtreeHeight(node.children[i]);
      if (i < node.children.length - 1) total += VERTICAL_GAP;
    }
    return Math.max(nh, total);
  }
  return measureSubtreeHeight(root) + HEADER_HEIGHT + 12;
}

function wrapInGhosts(
  leaf: TreeNode,
  colMap: ActiveColumns['columnIndexMap'],
  location: LocationWithStats,
): TreeNode {
  let node = leaf;
  if (colMap.position >= 0) {
    node = {
      id: `ghost-pos-${leaf.id}`,
      type: 'position' as TreeNodeType,
      name: '',
      iconId: null,
      accentColor: location.accent_color,
      isGhost: true,
      children: [node],
      depth: 2,
      column: colMap.position,
      childCount: 1,
      locationId: location.id,
    };
  }
  if (colMap.sublocation >= 0) {
    node = {
      id: `ghost-sub-${leaf.id}`,
      type: 'sublocation' as TreeNodeType,
      name: '',
      iconId: null,
      accentColor: location.accent_color,
      isGhost: true,
      children: [node],
      depth: 1,
      column: colMap.sublocation,
      childCount: 1,
      locationId: location.id,
    };
  }
  return node;
}

export function buildTreeData(
  locations: LocationWithStats[],
  subsByLocation: Record<string, SublocationWithStats[]>,
  posBySub: Record<string, PositionWithStats[]>,
  boxesByLocation: Record<string, LocationBoxWithStats[]>,
  foldersByLocation: Record<string, ItemFolderWithStats[]>,
  activeColumns: ActiveColumns,
): TreeNode[] {
  const colMap = activeColumns.columnIndexMap;

  return locations.map(location => {
    const locationBoxes = boxesByLocation[`location:${location.id}`] || [];
    const locationFolders = foldersByLocation[`location:${location.id}`] || [];
    const sublocations = subsByLocation[location.id] || [];

    const children: TreeNode[] = [];

    for (const sub of sublocations) {
      const subBoxes = boxesByLocation[sub.id] || [];
      const subFolders = foldersByLocation[sub.id] || [];
      const positions = posBySub[sub.id] || [];

      const subChildren: TreeNode[] = [];

      for (const pos of positions) {
        const posBoxes = boxesByLocation[pos.id] || [];
        const posFolders = foldersByLocation[pos.id] || [];

        const posChildren: TreeNode[] = [
          ...posBoxes.map(box => ({
            id: box.id,
            type: 'box' as TreeNodeType,
            name: box.name,
            iconId: box.icon_id,
            accentColor: box.accent_color,
            boxType: box.box_type,
            children: [],
            depth: 3,
            column: colMap.boxfolder,
            childCount: 0,
            utilizationPercent: box.utilizationPercent,
            totalCells: box.totalCells,
            occupiedCells: box.occupiedCells,
            locationId: location.id,
          })),
          ...posFolders.map(folder => ({
            id: folder.id,
            type: 'folder' as TreeNodeType,
            name: folder.name,
            iconId: folder.icon_id,
            accentColor: null,
            children: [],
            depth: 3,
            column: colMap.boxfolder,
            childCount: 0,
            itemCount: (folder as ItemFolderWithStats).item_count || 0,
            locationId: location.id,
          })),
        ];

        subChildren.push({
          id: pos.id,
          type: 'position' as TreeNodeType,
          name: pos.name,
          iconId: pos.icon_id,
          accentColor: pos.accent_color,
          children: posChildren,
          depth: 2,
          column: colMap.position,
          childCount: posChildren.length,
          locationId: location.id,
          sublocationId: sub.id,
          sublocationName: sub.name,
          sublocationAccentColor: sub.accent_color,
          sublocationLocationType: sub.location_type,
          sublocationIconId: sub.icon_id,
          positionLocationType: pos.location_type,
          locationType: pos.location_type,
        });
      }

      subChildren.push(
        ...subBoxes.map(box => {
          const boxNode: TreeNode = {
            id: box.id,
            type: 'box' as TreeNodeType,
            name: box.name,
            iconId: box.icon_id,
            accentColor: box.accent_color,
            boxType: box.box_type,
            children: [],
            depth: 3,
            column: colMap.boxfolder,
            childCount: 0,
            utilizationPercent: box.utilizationPercent,
            totalCells: box.totalCells,
            occupiedCells: box.occupiedCells,
            locationId: location.id,
          };
          if (colMap.position >= 0) {
            return {
              id: `ghost-pos-${box.id}`,
              type: 'position' as TreeNodeType,
              name: '',
              iconId: null,
              accentColor: sub.accent_color,
              isGhost: true,
              children: [boxNode],
              depth: 2,
              column: colMap.position,
              childCount: 1,
              locationId: location.id,
            };
          }
          return boxNode;
        }),
        ...subFolders.map(folder => {
          const folderNode: TreeNode = {
            id: folder.id,
            type: 'folder' as TreeNodeType,
            name: folder.name,
            iconId: folder.icon_id,
            accentColor: null,
            children: [],
            depth: 3,
            column: colMap.boxfolder,
            childCount: 0,
            itemCount: (folder as ItemFolderWithStats).item_count || 0,
            locationId: location.id,
          };
          if (colMap.position >= 0) {
            return {
              id: `ghost-pos-${folder.id}`,
              type: 'position' as TreeNodeType,
              name: '',
              iconId: null,
              accentColor: sub.accent_color,
              isGhost: true,
              children: [folderNode],
              depth: 2,
              column: colMap.position,
              childCount: 1,
              locationId: location.id,
            };
          }
          return folderNode;
        }),
      );

      children.push({
        id: sub.id,
        type: 'sublocation' as TreeNodeType,
        name: sub.name,
        iconId: sub.icon_id,
        accentColor: sub.accent_color,
        children: subChildren,
        depth: 1,
        column: colMap.sublocation,
        childCount: subChildren.length,
        locationId: location.id,
        locationType: sub.location_type,
      });
    }

    children.push(
      ...locationBoxes.map(box => {
        const boxNode: TreeNode = {
          id: box.id,
          type: 'box' as TreeNodeType,
          name: box.name,
          iconId: box.icon_id,
          accentColor: box.accent_color,
          boxType: box.box_type,
          children: [],
          depth: 3,
          column: colMap.boxfolder,
          childCount: 0,
          utilizationPercent: box.utilizationPercent,
          totalCells: box.totalCells,
          occupiedCells: box.occupiedCells,
          locationId: location.id,
        };
        return wrapInGhosts(boxNode, colMap, location);
      }),
      ...locationFolders.map(folder => {
        const folderNode: TreeNode = {
          id: folder.id,
          type: 'folder' as TreeNodeType,
          name: folder.name,
          iconId: folder.icon_id,
          accentColor: null,
          children: [],
          depth: 3,
          column: colMap.boxfolder,
          childCount: 0,
          itemCount: (folder as ItemFolderWithStats).item_count || 0,
          locationId: location.id,
        };
        return wrapInGhosts(folderNode, colMap, location);
      }),
    );

    return {
      id: location.id,
      type: 'location' as TreeNodeType,
      name: location.name,
      iconId: location.icon_id,
      accentColor: location.accent_color,
      children,
      depth: 0,
      column: colMap.location,
      childCount: children.length,
      locationId: location.id,
      locationType: location.location_type,
    };
  });
}

export interface ResolvedEdge {
  id: string;
  targetNodeId: string;
  startX: number;
  startY: number;
  waypoints: { x: number; y: number; width: number }[];
  endX: number;
  endY: number;
  accentColor: string | null;
}

export function computeResolvedEdges(nodes: PositionedNode[]): ResolvedEdge[] {
  const nodeMap = new Map<string, PositionedNode>();
  for (const n of nodes) {
    nodeMap.set(n.node.id, n);
  }

  const edges: ResolvedEdge[] = [];

  for (const n of nodes) {
    if (n.node.isGhost) continue;
    if (n.parentId === undefined) continue;

    const waypoints: { x: number; y: number; width: number }[] = [];
    let current = nodeMap.get(n.parentId);
    let accentColor: string | null = n.parentAccentColor ?? null;

    while (current && current.node.isGhost) {
      waypoints.unshift({ x: current.x, y: current.y + current.height / 2, width: current.width });
      if (current.parentId) {
        accentColor = current.parentAccentColor ?? accentColor;
        current = nodeMap.get(current.parentId);
      } else {
        current = undefined;
      }
    }

    if (!current) continue;

    const startX = current.x + current.width;
    const startY = current.y + current.height / 2;
    const endX = n.x;
    const endY = n.y + n.height / 2;

    edges.push({
      id: `resolved-${n.node.id}`,
      targetNodeId: n.node.id,
      startX,
      startY,
      waypoints,
      endX,
      endY,
      accentColor,
    });
  }

  return edges;
}

export function findMatchingNodeIds(roots: TreeNode[], query: string, typeFilter?: TreeNodeType | 'all'): Set<string> {
  const result = new Set<string>();
  const lowerQuery = query.toLowerCase().trim();

  function walk(node: TreeNode) {
    if (!node.isGhost) {
      const matchesType = !typeFilter || typeFilter === 'all' || node.type === typeFilter;
      const matchesQuery = !lowerQuery || node.name.toLowerCase().includes(lowerQuery);

      if (matchesType && matchesQuery) {
        result.add(node.id);
      }
    }

    for (const child of node.children) {
      walk(child);
    }
  }

  for (const root of roots) {
    walk(root);
  }

  return result;
}
