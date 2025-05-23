import { sequential } from './function'

export function isAsyncIteratorObject(maybe: unknown): maybe is AsyncIteratorObject<any, any, any> {
  if (!maybe || typeof maybe !== 'object') {
    return false
  }

  return Symbol.asyncIterator in maybe && typeof maybe[Symbol.asyncIterator] === 'function'
}

export interface CreateAsyncIteratorObjectCleanupFn {
  (reason: 'return' | 'throw' | 'next' | 'dispose'): Promise<void>
}

export function createAsyncIteratorObject<T, TReturn, TNext>(
  next: () => Promise<IteratorResult<T, TReturn>>,
  cleanup: CreateAsyncIteratorObjectCleanupFn,
): AsyncIteratorObject<T, TReturn, TNext> & AsyncGenerator<T, TReturn, TNext> {
  let isExecuteComplete = false
  let isDone = false

  const iterator = {
    next: sequential(async () => {
      if (isDone) {
        return { done: true, value: undefined as any }
      }

      try {
        const result = await next()

        if (result.done) {
          isDone = true
        }

        return result
      }
      catch (err) {
        isDone = true
        throw err
      }
      finally {
        if (isDone && !isExecuteComplete) {
          isExecuteComplete = true
          await cleanup('next')
        }
      }
    }),
    async return(value: any) {
      isDone = true
      if (!isExecuteComplete) {
        isExecuteComplete = true
        await cleanup('return')
      }

      return { done: true, value }
    },
    async throw(err: any) {
      isDone = true
      if (!isExecuteComplete) {
        isExecuteComplete = true
        await cleanup('throw')
      }

      throw err
    },
    /**
     * asyncDispose symbol only available in esnext, we should fallback to Symbol.for('asyncDispose')
     */
    async [(Symbol as any).asyncDispose as typeof Symbol extends { asyncDispose: infer T } ? T : any ?? Symbol.for('asyncDispose')]() {
      isDone = true
      if (!isExecuteComplete) {
        isExecuteComplete = true
        await cleanup('dispose')
      }
    },
    [Symbol.asyncIterator]() {
      return iterator
    },
  }

  return iterator
}
