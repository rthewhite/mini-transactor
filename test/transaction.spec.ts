import { example } from '../examples/http-rest-update';
import { ITask, Transaction } from '../src/transaction';

describe('Transaction', () => {
  it('Should apply the tasks', async () => {
    const transaction = new Transaction();
    let value = 0;

    const taskAddOne: ITask<number> = {
      apply: jest.fn(() => {
        value++;
        return Promise.resolve(value);
      })
    };

    const taskAddTen: ITask<number> = {
      apply: jest.fn(() => {
        value = value + 10;
        return Promise.resolve(value);
      })
    };

    const resultOne = await transaction.apply(taskAddOne);
    expect(resultOne).toBe(1);
    const resultTwo = await transaction.apply(taskAddTen);
    expect(resultTwo).toBe(11);
  });

  it('Should revert the tasks', async () => {
    const transaction = new Transaction();
    let value = 0;

    const taskAddOne: ITask<number> = {
      apply: jest.fn(() => {
        value++;
        return Promise.resolve(value);
      }),
      revert: jest.fn(() => {
        value--;
        return Promise.resolve(value);
      })
    };

    const taskAddTen: ITask<number> = {
      apply: jest.fn(() => {
        value = value + 10;
        return Promise.resolve(value);
      }),
      revert: jest.fn(() => {
        value = value - 10;
        return Promise.resolve(value);
      })
    };

    await transaction.apply(taskAddOne);
    await transaction.apply(taskAddTen);

    const revertResult = await transaction.revert();
    expect(revertResult.success).toBe(true);
    expect(revertResult.failedTasks).toBeUndefined();
    expect(revertResult.result).toBe(0);
    expect(value).toBe(0);
  });

  it('Should correctly work with parallel steps', async () => {
    const taskOne = {
      apply: jest.fn(() => Promise.resolve('one')),
      revert: jest.fn(() => Promise.resolve())
    };

    const taskTwo = {
      apply: jest.fn(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            return resolve('two');
          }, 1000);
        });
      }),
      revert: jest.fn(() => Promise.resolve())
    };

    const taskThree = {
      apply: jest.fn(() => Promise.resolve('three')),
      revert: jest.fn(() => Promise.resolve())
    };

    const taskFour = {
      apply: jest.fn(() => Promise.resolve('four')),
      revert: jest.fn(() => Promise.resolve())
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

    const revertReport = await transaction.revert();
    expect(revertReport.success).toBe(true);
    expect(revertReport.result).toBeUndefined();
  });

  it('should not allow to revert when a non revertable task applied in the transaction', async (done) => {
    const taskOne = {
      apply: jest.fn(() => Promise.resolve()),
      revert: jest.fn(() => Promise.resolve())
    };

    const taskTwo = {
      apply: jest.fn(() => Promise.resolve())
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
      apply: jest.fn(() => Promise.resolve()),
      revert: jest.fn(() => Promise.resolve())
    };

    const taskTwo = {
      apply: jest.fn(() => Promise.resolve())
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

  it('should not try to revert asynchronous tasks that failed', async (done) => {
    const taskOne = {
      apply: jest.fn(() => Promise.resolve()),
      revert: jest.fn(() => Promise.resolve())
    };

    const taskTwo = {
      apply: jest.fn(() => {
        return Promise.reject(new Error('Task two failed'));
      }),
      revert: jest.fn(() => Promise.resolve())
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
      apply: jest.fn(() => Promise.resolve()),
      revert: jest.fn(() => Promise.resolve())
    };

    const taskTwo = {
      apply: jest.fn(() => Promise.reject(new Error('Task two failed'))),
      revert: jest.fn(() => Promise.resolve())
    };

    const taskThree = {
      apply: jest.fn(() => Promise.resolve()),
      revert: jest.fn(() => Promise.resolve())
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

  it('should try to revert as much as possible even if one of the reverts fails', async (done) => {
    const taskOne = {
      apply: jest.fn(() => Promise.resolve()),
      revert: jest.fn(() => Promise.resolve())
    };

    const taskTwo = {
      apply: jest.fn(() => Promise.resolve()),
      revert: jest.fn(() => { throw new Error('Task two revert failed'); })
    };

    const taskThree = {
      apply: jest.fn(() => Promise.resolve()),
      revert: jest.fn(() => Promise.resolve())
    };

    const taskFour = {
      apply: jest.fn(() => Promise.resolve()),
      revert: jest.fn(() => { throw new Error('Task four revert failed'); })
    };

    const transaction = new Transaction();
    await transaction.apply(taskOne);
    await transaction.apply(taskTwo);
    await transaction.apply(taskThree);
    await transaction.apply(taskFour);

    try {
      await transaction.revert();
    } catch (e) {
      expect(taskOne.revert).toBeCalled();
      expect(taskTwo.revert).toBeCalled();
      expect(taskThree.revert).toBeCalled();
      expect(taskFour.revert).toBeCalled();

      expect(e.success).toBe(false);
      expect(e.failedTasks.length).toEqual(2);
      done();
    }
  });

  it('should retry tasks for the given retry count when they fail', async () => {
    let callCount = 0;
    const task = {
      apply: jest.fn(() => {
        if (callCount < 2 ) {
          callCount++;
          return Promise.reject(false);
        }

        callCount++;
        return Promise.resolve(true);
      })
    };

    const transaction = new Transaction({ retries: 2 });
    const resultOne = await transaction.apply(task);
    expect(task.apply.mock.calls.length).toBe(3);
    expect(resultOne).toBe(true);
  });

  it('should fail when the task still fails after retries', async (done) => {
    let callCount = 0;
    const task = {
      apply: jest.fn(() => {
        if (callCount < 2 ) {
          callCount++;
          return Promise.reject(false);
        }

        callCount++;
        return Promise.resolve(true);
      })
    };

    const transaction = new Transaction({ retries: 1 });

    try {
      await transaction.apply(task);
    } catch (e) {
      expect(e).toBe(false);
      done();
    }
  });

  it('should retry failures during reverting', async () => {
    const retryCount = 2;

    let callCount = 0;
    const task = {
      apply: jest.fn(() => Promise.resolve(true)),
      revert: jest.fn(() => {
        if (callCount < retryCount ) {
          callCount++;
          return Promise.reject(false);
        }

        callCount++;
        return Promise.resolve(true);
      })
    };

    const transaction = new Transaction({ retries: retryCount });
    const result = await transaction.apply(task);
    expect(result).toBe(true);

    const revertResult = await transaction.revert();
    expect(revertResult.success).toBe(true);
  });

  it('should capture failed tasked when reverting an apply all', async () => {
    const taskOne = {
      apply: jest.fn(() => Promise.resolve()),
      revert: jest.fn(() => Promise.reject())
    };

    const taskTwo = {
      apply: jest.fn(() => Promise.resolve()),
      revert: jest.fn(() => Promise.reject())
    };

    const transaction = new Transaction();
    await transaction.applyAll([taskOne, taskTwo]);

    try {
      transaction.revert();
    } catch (e) {
      expect(e.success).toBe(false);
      expect(e.failedTasks.length).toBe(2);
    }
  });

  describe('Execute examples to make sure they keep working', async () => {
    it('should execute the http-rest-update example correctly', async () => {
      await example();
    });
  });
});
