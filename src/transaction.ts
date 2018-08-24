// Copyright 2018 Raymond de Wit

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//     http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

export interface ITask<T> {
  apply: () => Promise<T>;
  revert?: () => Promise<T|any>;
}

export interface ITransactionConfig {
  retries: number;
}

export interface IFailedTask {
  task: ITask<any>;
  error: Error;
}

export interface IRevertReport {
  success: boolean;
  failedTasks?: IFailedTask[];
  result?: any;
}

export class Transaction {
  public finished = false;

  // Nesting it further doesn't make sense TODO
  private appliedTasks: Array<ITask<any>|Array<ITask<any>>> = [];
  private revertable = true;
  private maxRetries = 0;

  constructor(config?: ITransactionConfig) {
    if (config && config.retries !== undefined) {
      this.maxRetries = config.retries;
    }
  }

  public apply(task: ITask<any>): Promise<any> {
    return new Promise((resolve, reject) => {
      this.applyTask(task).then((result) => {
        this.appliedTasks.push(task);

        if (!task.revert) {
          this.revertable = false;
        }

        resolve(result);
      }).catch(reject);
    });
  }

  public applyAll(tasks: Array<ITask<any>>): Promise<any> {
    const appliedTasksIndex = this.appliedTasks.length;
    this.appliedTasks.push([]);

    const promises: any[] = [];

    tasks.forEach((task) => {
      promises.push(this.applyTask(task)
        .then((result) => {
          const array = this.appliedTasks[appliedTasksIndex] as Array<ITask<any>>;
          array.push(task);

          if (!task.revert) {
            this.revertable = false;
          }

          return result;
        }));
    });

    return Promise.all(promises);
  }

  public async revert(): Promise<IRevertReport> {
    if (!this.isRevertable) {
      throw new Error('This is a irrevertable transaction');
    }

    const failedReverts: Array<ITask<any>> = [];
    return new Promise<IRevertReport>(async (resolve, reject) => {
      let result: any;

      while (this.appliedTasks.length > 0) {
        const task = this.appliedTasks.pop();

        if (Array.isArray(task)) {
          const promises: Array<Promise<any>> = [];

          task.forEach((tsk) => {
            const promise = this.revertTask(tsk);

            promise
              .catch(() => {
                failedReverts.push(tsk);
              });

            promises.push(promise);
          });

          try {
            result = await Promise.all(promises);
          } catch (e) {
            // Swallow the error, we want to continue, failing tasks will be captured above
          }
        } else {
          try {
            result = await this.revertTask(task);
          } catch (e) {
            failedReverts.push(task as ITask<any>);
          }
        }
      }

      if (failedReverts.length === 0) {
        resolve({
          success: true,
          result
        });
      } else {
        reject({
          success: false,
          failedTasks: failedReverts
        });
      }
    });
  }

  get isRevertable(): boolean {
    return this.revertable;
  }

  private applyTask(task: ITask<any>): Promise<any> {
    const maxRetries = this.maxRetries * 1;
    return this.tryAtMost(task.apply, maxRetries);
  }

  private revertTask(task: ITask<any>): Promise<any> {
    const maxRetries = this.maxRetries * 1;
    return this.tryAtMost(task.revert as () => Promise<any>, maxRetries);
  }

  private tryAtMost(fn: () => any, retriesLeft: number ): Promise<any> {
    return new Promise((resolve, reject) => {
      fn()
        .then(resolve)
        .catch((e: any) => {
          if (retriesLeft > 0) {
            retriesLeft--;
            this.tryAtMost(fn, retriesLeft)
              .then(resolve)
              .catch(reject);
          } else {
            reject(e);
          }
        });
    });
  }
}
