type NodeAccessor<T> = (node: T) => T | null;
type ChildrenAccessor<T> = (node: T) => T[];

function getSiblings<T>(
  node: T,
  getParent: NodeAccessor<T>,
  getChildren: ChildrenAccessor<T>
): T[] {
  const p = getParent(node);
  if (p != null) {
    return getChildren(p);
  }
  return [];
}

function* forwardAndUpTraversal<T>(
  startNode: T,
  getParent: NodeAccessor<T>,
  getChildren: ChildrenAccessor<T>
): Generator<T, void, unknown> {
  let currentNode: T | null = startNode;

  while (currentNode) {
    yield currentNode;

    if (getParent(currentNode)) {
      const siblings: T[] = getSiblings(currentNode, getParent, getChildren);
      const currentIndex = siblings.indexOf(currentNode);

      if (currentIndex < siblings.length - 1) {
        currentNode = siblings[currentIndex + 1];
      } else {
        currentNode = getParent(currentNode);
      }
    } else {
      currentNode = null;
    }
  }
}

function* backwardAndUpTraversal<T>(
  startNode: T,
  getParent: NodeAccessor<T>,
  getChildren: ChildrenAccessor<T>
): Generator<T, void, unknown> {
  let currentNode: T | null = startNode;

  while (currentNode) {
    yield currentNode;

    const siblings: T[] = getSiblings(currentNode, getParent, getChildren);
    const currentIndex = siblings.indexOf(currentNode);

    if (currentIndex > 0) {
      currentNode = siblings[currentIndex - 1];
    } else {
      currentNode = getParent(currentNode);
    }
  }
}

function* forwardAndOverTraversal<T>(
  startNode: T,
  getParent: NodeAccessor<T>,
  getChildren: ChildrenAccessor<T>
): Generator<T, void, unknown> {
  let currentNode: T | null = startNode;

  while (currentNode) {
    yield currentNode;

    let nextNode: T | null = null;
    let potentialParent: T | null = currentNode;

    while (!nextNode && potentialParent) {
      const siblings: T[] = getSiblings(potentialParent, getParent, getChildren);
      const currentIndex = siblings.indexOf(potentialParent);

      if (currentIndex < siblings.length - 1) {
        nextNode = siblings[currentIndex + 1];
      } else {
        potentialParent = getParent(potentialParent);
      }
    }

    currentNode = nextNode;
  }
}

function* depthFirstTraversal<T>(
  startNode: T,
  getChildren: ChildrenAccessor<T>
): Generator<T, void, unknown> {
  yield startNode;

  const children = getChildren(startNode);
  for (let child of children) {
    yield* depthFirstTraversal(child, getChildren);
  }
}

function* breadthFirstTraversal<T>(
  startNode: T,
  getChildren: ChildrenAccessor<T>
): Generator<T, void, unknown> {
  const queue: (T | null)[] = [startNode];

  while (queue.length > 0) {
    const currentNode = queue.shift();

    if (currentNode) {
      yield currentNode;

      const children = getChildren(currentNode);
      queue.push(...children);
    }
  }
}

interface TraversalFunctions<T> {
  breadthFirstTraversal: (startNode: T) => Generator<T, void, unknown>;
  depthFirstTraversal: (startNode: T) => Generator<T, void, unknown>;
  backwardAndUpTraversal: (startNode: T) => Generator<T, void, unknown>;
  forwardAndOverTraversal: (startNode: T) => Generator<T, void, unknown>;
  forwardAndUpTraversal: (startNode: T) => Generator<T, void, unknown>;
}

function getTraversalFunctions<T>(
  getParent: NodeAccessor<T>,
  getChildren: ChildrenAccessor<T>,
): TraversalFunctions<T> {
  return {
    breadthFirstTraversal: (startNode: T) => breadthFirstTraversal(startNode, getChildren),
    depthFirstTraversal: (startNode: T) => depthFirstTraversal(startNode, getChildren),
    backwardAndUpTraversal: (startNode: T) => backwardAndUpTraversal(startNode, getParent, getChildren),
    forwardAndOverTraversal: (startNode: T) => forwardAndOverTraversal(startNode, getParent, getChildren),
    forwardAndUpTraversal: (startNode: T) => forwardAndUpTraversal(startNode, getParent, getChildren),
  };
}

export {
  breadthFirstTraversal,
  depthFirstTraversal,
  backwardAndUpTraversal,
  forwardAndOverTraversal,
  forwardAndUpTraversal,
  getTraversalFunctions,
};
