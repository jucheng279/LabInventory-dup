import React from 'react';
import type { ItemSheetWithStats } from '../types/database';
import ItemSheetCard from './ItemSheetCard';

interface ItemFolderCardProps {
  folder: ItemSheetWithStats;
  onOpen: (folder: ItemSheetWithStats) => void;
  onEdit: (folder: ItemSheetWithStats) => void;
  onDelete: (folder: ItemSheetWithStats) => void;
  onMove: (folder: ItemSheetWithStats) => void;
  isExiting?: boolean;
}

const ItemFolderCard: React.FC<ItemFolderCardProps> = ({ folder, onOpen, onEdit, onDelete, onMove, isExiting }) => (
  <ItemSheetCard sheet={folder} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} onMove={onMove} isExiting={isExiting} />
);

export default ItemFolderCard;
