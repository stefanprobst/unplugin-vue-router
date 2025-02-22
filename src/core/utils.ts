import { TreeNode } from './tree'
import type { RouteRecordOverride, TreeRouteParam } from './treeNodeValue'
import { pascalCase } from 'scule'

export type Awaitable<T> = T | PromiseLike<T>

export type LiteralStringUnion<LiteralType, BaseType extends string = string> =
  | LiteralType
  | (BaseType & Record<never, never>)

export function logTree(tree: TreeNode, log: (str: string) => any) {
  log(printTree(tree))
}

const MAX_LEVEL = 1000
function printTree(
  tree: TreeNode | TreeNode['children'],
  level = 0,
  parentPre = '',
  treeStr = ''
): string {
  // end of recursion
  if (typeof tree !== 'object' || level >= MAX_LEVEL) return ''

  if (tree instanceof Map) {
    const total = tree.size
    let index = 0
    for (const [_key, child] of tree) {
      const hasNext = index++ < total - 1
      const { children } = child

      treeStr += `${`${parentPre}${hasNext ? '├' : '└'}── `}${child}\n`

      if (children) {
        treeStr += printTree(
          children,
          level + 1,
          `${parentPre}${hasNext ? '│' : ' '}   `
        )
      }
    }
  } else {
    const children = tree.children
    treeStr = `${tree}\n`
    if (children) {
      treeStr += printTree(children, level + 1)
    }
  }

  return treeStr
}

/**
 * Typesafe alternative to Array.isArray
 * https://github.com/microsoft/TypeScript/pull/48228
 */
export const isArray: (arg: ArrayLike<any> | any) => arg is ReadonlyArray<any> =
  Array.isArray

export function trimExtension(path: string) {
  const lastDot = path.lastIndexOf('.')
  return lastDot < 0 ? path : path.slice(0, lastDot)
}

export function throttle(fn: () => void, wait: number, initialWait: number) {
  let pendingExecutionTimeout: ReturnType<typeof setTimeout> | null = null
  let pendingExecution = false
  let executionTimeout: ReturnType<typeof setTimeout> | null = null

  return () => {
    if (pendingExecutionTimeout == null) {
      pendingExecutionTimeout = setTimeout(() => {
        pendingExecutionTimeout = null
        if (pendingExecution) {
          pendingExecution = false
          fn()
        }
      }, wait)
      executionTimeout = setTimeout(() => {
        executionTimeout = null
        fn()
      }, initialWait)
    } else if (executionTimeout == null) {
      // we run the function recently, so we can skip it and add a pending execution
      pendingExecution = true
    }
  }
}

const LEADING_SLASH_RE = /^\//
const TRAILING_SLASH_RE = /\/$/
export function joinPath(...paths: string[]): string {
  let result = ''
  for (const path of paths) {
    result =
      result.replace(TRAILING_SLASH_RE, '') +
      // check path to avoid adding a trailing slash when joining an empty string
      (path && '/' + path.replace(LEADING_SLASH_RE, ''))
  }
  return result
}

function paramToName({ paramName, modifier, isSplat }: TreeRouteParam) {
  return `${isSplat ? '$' : ''}${
    paramName.charAt(0).toUpperCase() + paramName.slice(1)
  }${
    modifier
    // ? modifier === '+'
    //   ? 'OneOrMore'
    //   : modifier === '?'
    //   ? 'ZeroOrOne'
    //   : 'ZeroOrMore'
    // : ''
  }`
}

/**
 * Creates a name based of the node path segments.
 *
 * @param node - the node to get the path from
 * @param parent - the parent node
 * @returns a route name
 */
export function getPascalCaseRouteName(node: TreeNode): string {
  if (node.parent?.isRoot() && node.value.pathSegment === '') return 'Root'

  let name = node.value.subSegments
    .map((segment) => {
      if (typeof segment === 'string') {
        return pascalCase(segment)
      }
      // else it's a param
      return paramToName(segment)
    })
    .join('')

  if (node.value.filePaths.size && node.children.has('index')) {
    name += 'Parent'
  }

  const parent = node.parent

  return (
    (parent && !parent.isRoot()
      ? getPascalCaseRouteName(parent).replace(/Parent$/, '')
      : '') + name
  )
}

/**
 * Joins the path segments of a node into a name that corresponds to the filepath represented by the node.
 *
 * @param node - the node to get the path from
 * @returns a route name
 */
export function getFileBasedRouteName(node: TreeNode): string {
  if (!node.parent) return ''
  return getFileBasedRouteName(node.parent) + '/' + node.value.rawSegment
}

export function mergeRouteRecordOverride(
  a: RouteRecordOverride,
  b: RouteRecordOverride
): RouteRecordOverride {
  const merged: RouteRecordOverride = {}
  const keys = [
    ...new Set<keyof RouteRecordOverride>([
      ...(Object.keys(a) as (keyof RouteRecordOverride)[]),
      ...(Object.keys(b) as (keyof RouteRecordOverride)[]),
    ]),
  ]
  for (const key of keys) {
    if (key === 'alias') {
      merged[key] = [...(a[key] || []), ...(b[key] || [])]
    } else if (key === 'meta') {
      merged[key] = mergeDeep(a[key] || {}, b[key] || {})
    } else {
      // @ts-expect-error: TS cannot see it's the same key
      merged[key] = b[key] ?? a[key]
    }
  }

  return merged
}

function isObject(obj: any): obj is Record<any, any> {
  return obj && typeof obj === 'object'
}

function mergeDeep(...objects: Array<Record<any, any>>): Record<any, any> {
  return objects.reduce((prev, obj) => {
    Object.keys(obj).forEach((key) => {
      const pVal = prev[key]
      const oVal = obj[key]

      if (Array.isArray(pVal) && Array.isArray(oVal)) {
        prev[key] = pVal.concat(...oVal)
      } else if (isObject(pVal) && isObject(oVal)) {
        prev[key] = mergeDeep(pVal, oVal)
      } else {
        prev[key] = oVal
      }
    })

    return prev
  }, {})
}
