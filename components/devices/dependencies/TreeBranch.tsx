'use client'

import type { TreeNode } from '../hooks/useDependencyTree'
import { TreeNodeDisplay } from './TreeNode'

interface TreeBranchProps {
  node: TreeNode
  targetDeviceId: string
  depth?: number
  isLast?: boolean
  prefix?: string
}

export function TreeBranch({
  node,
  targetDeviceId,
  depth = 0,
  isLast = true,
  prefix = '',
}: TreeBranchProps) {
  const isTarget = node.device_id === targetDeviceId
  const hasChildren = node.children.length > 0
  const connector = depth === 0 ? '' : isLast ? '└── ' : '├── '
  const childPrefix = depth === 0 ? '' : prefix + (isLast ? '    ' : '│   ')

  return (
    <div className="font-mono text-[10px]">
      {/* Current node */}
      <div className="flex whitespace-pre">
        <span className="text-green-500/30">{prefix}{connector}</span>
        <TreeNodeDisplay
          deviceId={node.device_id}
          name={node.name}
          tier={node.tier}
          techTree={node.tech_tree}
          status={node.status}
          isCrossTree={node.is_cross_tree}
          isTarget={isTarget}
        />
      </div>

      {/* Vertical connector to children */}
      {hasChildren && (
        <div className="text-green-500/30 whitespace-pre">
          {childPrefix}│
          {childPrefix}▼
        </div>
      )}

      {/* Children */}
      {node.children.map((child, i) => (
        <TreeBranch
          key={child.device_id}
          node={child}
          targetDeviceId={targetDeviceId}
          depth={depth + 1}
          isLast={i === node.children.length - 1}
          prefix={childPrefix}
        />
      ))}
    </div>
  )
}
