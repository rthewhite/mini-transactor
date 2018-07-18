import { ITask, Transaction } from '../src/transaction';

export class AddTaskSynchronous implements ITask<number> {
  constructor(private value: number, private add: number) {}
  public apply() {
    this.value = this.value + this.add;
    return this.value;
  }

  public revert() {
    this.value = this.value - this.add;
    return this.value;
  }
}

export class MinusTaskSynchronous implements ITask<number> {
  constructor(private value: number, private minus: number) {}
  public apply() {
    this.value = this.value - this.minus;
    return this.value;
  }

  public revert() {
    this.value = this.value + this.minus;
    return this.value;
  }
}

export class AddTaskAsynchronous implements ITask<number> {
  constructor(private value: number, private add: number) {}
  public apply() {
    this.value = this.value + this.add;
    return Promise.resolve(this.value);
  }

  public revert() {
    this.value = this.value - this.add;
    return Promise.resolve(this.value);
  }
}

export class MinusTaskAsynchronous implements ITask<number> {
  constructor(private value: number, private minus: number) {}
  public apply() {
    this.value = this.value - this.minus;
    return Promise.resolve(this.value);
  }

  public revert() {
    this.value = this.value + this.minus;
    return Promise.resolve(this.value);
  }
}

describe('Transaction', () => {
  describe('Synchronous tasks', () => {
    it('Should apply the tasks', async () => {
      const transaction = new Transaction();

      let value = 0;
      value = await transaction.apply(new AddTaskSynchronous(value, 1));
      value = await transaction.apply(new AddTaskSynchronous(value, 10));

      expect(value).toBe(11);
    });

    it('Should revert the tasks', async () => {
      const transaction = new Transaction();

      let value = 0;
      value = await transaction.apply(new AddTaskSynchronous(value, 1));
      value = await transaction.apply(new AddTaskSynchronous(value, 10));
      value = await transaction.revert();

      expect(value).toBe(0);
    });
  });

  describe('Asynchronous tasks', () => {
    it('Should apply the tasks correctly', async () => {
      const transaction = new Transaction();

      let value = 0;
      value = await transaction.apply(new AddTaskAsynchronous(value, 1));
      value = await transaction.apply(new AddTaskAsynchronous(value, 10));

      expect(value).toBe(11);
    });

    it('Should revert the tasks', async () => {
      const transaction = new Transaction();

      let value = 0;
      value = await transaction.apply(new AddTaskAsynchronous(value, 1));
      value = await transaction.apply(new AddTaskAsynchronous(value, 10));
      value = await transaction.revert();

      expect(value).toBe(0);
    });
  });

  describe('Mix and match sync and async tasks', () => {
    it('Should apply the tasks correctly', async () => {
      const transaction = new Transaction();

      let value = 0;
      value = await transaction.apply(new AddTaskAsynchronous(value, 1));
      value = await transaction.apply(new AddTaskSynchronous(value, 10));

      expect(value).toBe(11);
    });

    it('Should revert the tasks', async () => {
      const transaction = new Transaction();

      let value = 0;
      value = await transaction.apply(new AddTaskSynchronous(value, 1));
      value = await transaction.apply(new AddTaskAsynchronous(value, 10));
      value = await transaction.revert();

      expect(value).toBe(0);
    });
  });

  describe('Test parallel tasks', () => {
    it('Should correctly work with (async) parallel steps', async () => {
      const taskOne = {
        apply: jest.fn(() => 'one'),
        revert: jest.fn()
      };

      const taskTwo = {
        apply: jest.fn(() => {
          return new Promise((resolve) => {
            setTimeout(() => {
              return resolve('two');
            }, 1000);
          });
        }),
        revert: jest.fn()
      };

      const taskThree = {
        apply: jest.fn(() => 'three'),
        revert: jest.fn()
      };

      const taskFour = {
        apply: jest.fn(() => 'four'),
        revert: jest.fn()
      };

      const transaction = new Transaction();
      let result;

      result = await transaction.apply(taskOne);
      expect(result).toBe('one');
      result = await transaction.applyAll([taskTwo, taskThree]);
      expect(result[0]).toBe('two');
      expect(result[1]).toBe('three');
      result = await transaction.apply(taskFour);
      expect(result).toBe('four');

      result = await transaction.revert();

      expect(result).toBe(undefined);
    });
  });

  describe('When executing a non revertable task, the transaction should become non revertable', () => {
    it('should not allow to revert when a non revertable task applied in the transaction', async (done) => {
      const taskOne = {
        apply: jest.fn(),
        revert: jest.fn()
      };

      const taskTwo = {
        apply: jest.fn()
      };

      const transaction = new Transaction();
      await transaction.apply(taskOne);
      await transaction.apply(taskTwo);

      expect(transaction.isRevertable).toBe(false);

      transaction.revert()
        .catch((e) => {
          expect(e).toBeInstanceOf(Error);
          done();
        });
    });

    it('should not allow to revert when a non revertable task applyAll is in the transaction', async (done) => {
      const taskOne = {
        apply: jest.fn(),
        revert: jest.fn()
      };

      const taskTwo = {
        apply: jest.fn()
      };

      const transaction = new Transaction();
      await transaction.applyAll([taskOne, taskTwo]);

      expect(transaction.isRevertable).toBe(false);

      transaction.revert()
        .catch((e) => {
          expect(e).toBeInstanceOf(Error);
          done();
        });
    });
  });

  describe('Error handling', async () => {
    it('should not try to revert synchronous tasks that failed', async (done) => {
      const taskOne = {
        apply: jest.fn(),
        revert: jest.fn()
      };

      const taskTwo = {
        apply: jest.fn(() => {
          throw Error('Task two failed');
        }),
        revert: jest.fn()
      };

      const transaction = new Transaction();

      try {
        await transaction.apply(taskOne);
        await transaction.apply(taskTwo);
      } catch (e) {
        expect(e.message).toBe('Task two failed');
        expect(e).toBeInstanceOf(Error);

        await transaction.revert();

        expect(taskOne.revert).toBeCalled();
        expect(taskTwo.revert).not.toBeCalled();

        done();
      }
    });

    it('should not try to revert asynchronous tasks that failed', async (done) => {
      const taskOne = {
        apply: jest.fn(),
        revert: jest.fn()
      };

      const taskTwo = {
        apply: jest.fn(() => {
          return Promise.reject(new Error('Task two failed'));
        }),
        revert: jest.fn()
      };

      const transaction = new Transaction();

      try {
        await transaction.apply(taskOne);
        await transaction.apply(taskTwo);
      } catch (e) {
        expect(e.message).toBe('Task two failed');
        expect(e).toBeInstanceOf(Error);

        await transaction.revert();

        expect(taskOne.revert).toBeCalled();
        expect(taskTwo.revert).not.toBeCalled();

        done();
      }
    });

    it('should not try to revert tasks that failed when using applyAll', async (done) => {
      const taskOne = {
        apply: jest.fn(),
        revert: jest.fn()
      };

      const taskTwo = {
        apply: jest.fn(() => Promise.reject(new Error('Task two failed'))),
        revert: jest.fn()
      };

      const taskThree = {
        apply: jest.fn(() => Promise.resolve()),
        revert: jest.fn()
      };

      const transaction = new Transaction();

      try {
        await transaction.apply(taskOne);
        await transaction.applyAll([taskTwo, taskThree]);
      } catch (e) {
        expect(e.message).toBe('Task two failed');
        expect(e).toBeInstanceOf(Error);

        await transaction.revert();

        expect(taskOne.revert).toBeCalled();
        expect(taskTwo.revert).not.toBeCalled();
        expect(taskThree.revert).toBeCalled();
        done();
      }
    });

    it('should try to revert as much as possible even if one of the reverts fails', async () => {
      const taskOne = {
        apply: jest.fn(),
        revert: jest.fn()
      };

      const taskTwo = {
        apply: jest.fn(),
        revert: jest.fn(() => { throw new Error('Task two revert failed'); })
      };

      const taskThree = {
        apply: jest.fn(),
        revert: jest.fn()
      };

      const taskFour = {
        apply: jest.fn(),
        revert: jest.fn(() => { throw new Error('Task four revert failed'); })
      };

      const transaction = new Transaction();
      await transaction.apply(taskOne);
      await transaction.apply(taskTwo);
      await transaction.apply(taskThree);
      await transaction.apply(taskFour);

      await transaction.revert();
      expect(taskOne.revert).toBeCalled();
      expect(taskTwo.revert).toBeCalled();
      expect(taskThree.revert).toBeCalled();
      expect(taskFour.revert).toBeCalled();
    });
  });
});
