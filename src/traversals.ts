type NodeAccessor<T> = (node: T) => T | null;
type ChildrenAccessor<T> = (node: T) => T[];

function* forwardAndUpTraversal<T>(
  startNode: T,
  getParent: NodeAccessor<T>,
  getChildren: ChildrenAccessor<T>
): Generator<T, void, unknown> {
  yield startNode;
  const parent = getParent(startNode);
  if (!parent) {
    return;
  }
  const siblings = getChildren(parent);
  for (let i = siblings.indexOf(startNode) + 1; i < siblings.length; i++) {
    yield siblings[i];
  }
  yield* forwardAndUpTraversal(parent, getParent, getChildren);
}

function* backwardAndUpTraversal<T>(
  startNode: T,
  getParent: NodeAccessor<T>,
  getChildren: ChildrenAccessor<T>
): Generator<T, void, unknown> {
  yield startNode;
  const parent = getParent(startNode);
  if (!parent) {
    return;
  }
  const siblings = getChildren(parent);
  for (let i = siblings.indexOf(startNode) - 1; i > 0; i--) {
    yield siblings[i];
  }
  yield* backwardAndUpTraversal(parent, getParent, getChildren);
}

// come to think, you could implement a depth first traversal
// with this as the up step
function* forwardAndOverTraversal<T>(
  startNode: T,
  getParent: NodeAccessor<T>,
  getChildren: ChildrenAccessor<T>
): Generator<T, void, unknown> {
  yield startNode;
  const parent = getParent(startNode);
  if (!parent) {
    return;
  }
  const siblings = getChildren(parent);
  const startInx = siblings.indexOf(startNode);
  for (let i = startInx + 1; i < siblings.length; i++) {
    yield siblings[i];
  }
  const g = forwardAndOverTraversal(parent, getParent, getChildren);
  // skip parent
  g.next();
  // carry on
  yield* g;
}

function* depthFirstTraversalDown<T>(
  startNode: T,
  getChildren: ChildrenAccessor<T>
): Generator<T, void, unknown> {
  yield startNode;

  const children = getChildren(startNode);
  for (let child of children) {
    yield* depthFirstTraversalDown(child, getChildren);
  }
}

function* depthFirstTraversal<T>(
  startNode: T,
  getParent: NodeAccessor<T>,
  getChildren: ChildrenAccessor<T>
): Generator<T, void, unknown> {
  yield startNode;

  const children = getChildren(startNode);
  for (let child of children) {
    yield* depthFirstTraversalDown(child, getChildren);
  }

  // walk upwards
  let currentNode = startNode;
  for (
    let parentNode = getParent(currentNode);
    parentNode !== null;
    parentNode = getParent(currentNode)
  ) {
    const siblings = getChildren(parentNode);
    const ownInx = siblings.indexOf(currentNode);
    for (let i = ownInx + 1; i < siblings.length; i++) {
      yield* depthFirstTraversalDown(siblings[i], getChildren);
    }
    currentNode = parentNode;
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
  depthFirstTraversalDown: (startNode: T) => Generator<T, void, unknown>;
}

function getTraversalFunctions<T>(
  getParent: NodeAccessor<T>,
  getChildren: ChildrenAccessor<T>
): TraversalFunctions<T> {
  return {
    breadthFirstTraversal: (startNode: T) =>
      breadthFirstTraversal(startNode, getChildren),
    depthFirstTraversal: (startNode: T) =>
      depthFirstTraversal(startNode, getParent, getChildren),
    backwardAndUpTraversal: (startNode: T) =>
      backwardAndUpTraversal(startNode, getParent, getChildren),
    forwardAndOverTraversal: (startNode: T) =>
      forwardAndOverTraversal(startNode, getParent, getChildren),
    forwardAndUpTraversal: (startNode: T) =>
      forwardAndUpTraversal(startNode, getParent, getChildren),
    depthFirstTraversalDown: (startNode: T) =>
      depthFirstTraversalDown(startNode, getChildren),
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
