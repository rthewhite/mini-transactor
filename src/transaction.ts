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
  apply: () => Promise<T> | T;
  revert?: () => Promise<T> | T;
}

export class Transaction {
  public finished = false;

  // Nesting it further doesn't make sense TODO
  private appliedTasks: Array<ITask<any>|Array<ITask<any>>> = [];

  private revertable = true;

  public apply(task: ITask<any>): Promise<any> {
    return this.applyTask(task).then((result) => {
      this.appliedTasks.push(task);

      if (!task.revert) {
        this.revertable = false;
      }

      return result;
    });
  }

  public applyAll(tasks: Array<ITask<any>>): Promise<any> {
    const appliedTasksIndex = this.appliedTasks.length;
    this.appliedTasks.push([]);

    const promises: any[] = [];

    tasks.forEach((task) => {
      const promise = this.applyTask(task);

      promise
        .then(() => {
          const array = this.appliedTasks[appliedTasksIndex] as Array<ITask<any>>;
          array.push(task);

          if (!task.revert) {
            this.revertable = false;
          }
        })
        .catch(() => {
          // We need to catch the error in this chain otherwise nodejs will exit
          // but the error should actually be captured by the caller off applyAll
          // because the promise.all will also fail
        });

      promises.push(promise);
    });

    return Promise.all(promises);
  }

  public async revert(): Promise<any> {
    if (!this.isRevertable) {
      throw new Error('This is a irrevertable transaction');
    }

    let result: any;

    while (this.appliedTasks.length > 0) {
      const task = this.appliedTasks.pop();

      if (Array.isArray(task)) {
        const promises: Array<Promise<any>> = [];

        task.forEach((tsk) => {
          promises.push(this.revertTask(tsk));
        });

        result = await Promise.all(promises);

      } else {
        try {
          result = await this.revertTask(task);
        } catch (e) {
          console.log('failed to revert a task, continuing....');
        }
      }
    }

    return result;
  }

  get isRevertable(): boolean {
    return this.revertable;
  }

  private applyTask(task: ITask<any>): Promise<any> {
    try {
      const result = task.apply();

      if (result instanceof Promise) {
        return result;
      } else {
        return Promise.resolve(result);
      }

    } catch (e) {
      return Promise.reject(e);
    }
  }

  private async revertTask(task?: ITask<any>): Promise<any> {
    try {
      // Ignore this line for coverage, the scenario
      // were a task is not reverted is prevented in logic above
      /* istanbul ignore next line */
      if (task && task.revert) {
        const result = task.revert();

        if (result instanceof Promise) {
          return result;
        } else {
          return Promise.resolve(result);
        }
      }
    } catch (e) {
      return Promise.reject(e);
    }
  }
}
