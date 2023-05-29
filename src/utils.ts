function* mapGenerator<T, U>(
  generator: Generator<T>,
  mapFn: (value: T) => U
): Generator<U> {
  for (let value of generator) {
    yield mapFn(value);
  }
}

function filterGenerator<T, G extends T>(
  generator: Generator<T>,
  predicate: (value: T) => value is G
): Generator<G>;
function filterGenerator<T>(
  generator: Generator<T>,
  predicate: (value: T) => boolean
): Generator<T>;
function filterGenerator<T>(
  generator: Generator<T>,
  predicate: (value: T) => boolean
): any {
  let next = generator.next();
  return {
    next: () => {
      while (!next.done) {
        if (predicate(next.value)) {
          let result = { value: next.value, done: false };
          next = generator.next();
          return result;
        }
        next = generator.next();
      }
      return { value: undefined, done: true };
    },
    [Symbol.iterator]: function () {
      return this;
    },
  };
}

// Here is a simple type-guard to check non-null values
function isNonNullable<T>(x: T | null | undefined): x is NonNullable<T> {
  return x !== null && x !== undefined;
}

function enforcePresence<T>(x: T): NonNullable<T> {
  if (isNonNullable(x)) {
    return x;
  }
  throw TypeError('Expected a non-null, non-undefined value, but got null or undefined');
}

function getNthGeneratorItem<T>(generator: Generator<T>, n: number): T | null {
  let currentIndex = 0;
  let result: IteratorResult<T>;

  while (currentIndex <= n) {
    result = generator.next();

    if (result.done) {
      // Generator finished before reaching the nth item
      return null;
    }

    if (currentIndex === n) {
      // Found the nth item
      return result.value;
    }

    currentIndex++;
  }

  // Generator exhausted before reaching the nth item
  return null;
}

/**
 * Obviously inefficient for traversals, but easier than
 * defining up and down directions for picking up traversals
 * at some middle element, and in this context that kind of 
 * efficiency REALLY doesn't matter
 * @param generator 
 * @param item 
 * @returns 
 */
function* skipUntilItem<T>(generator: Generator<T>, item: T): Generator<T> {
  let result = generator.next();
  while (!result.done && result.value !== item) {
      result = generator.next();
  }

  // Check if we've found the item
  if(result.done) {
      return; // If end of the generator is reached
  } else {
      yield result.value; // Yield the matched item
  }

  // Yield remaining values from the original generator
  for (let value of generator) {
      yield value;
  }
}


export { mapGenerator, filterGenerator, isNonNullable, enforcePresence, getNthGeneratorItem, skipUntilItem };
