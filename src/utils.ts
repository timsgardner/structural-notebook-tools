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

export { mapGenerator, filterGenerator, isNonNullable, enforcePresence };
