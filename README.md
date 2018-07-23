# mini-transactor

Simple way of doing transactions with promises.

[![CircleCI](https://circleci.com/gh/rthewhite/mini-transactor.svg?style=svg)](https://circleci.com/gh/rthewhite/mini-transactor)

## Introduction
Imagine the scenario were you are communicating with an REST API, to accomplish the scenario you are working on
you need to do multiple calls to the api to create entities and then link them together. During the process of this
one of the api calls fails. What do you do?

Wouldn't it be great to easily retry the api call or revert the things you have just done? That's exactly what this little package solves for you.

## Example
When using this package you create an transaction, in this transaction you can apply multiple (simultaneous) tasks.
If a task fails during execution it will automatically be retried. And if it fails, you can easily revert everything you have done.
Below is an example of the flow, the full example including how to create a task is found in the examples folder.

```
const transaction = new Transaction();

try {
  const customerGUID    = await transaction.apply(new CreateCustomerTask());
  const results         = await transaction.applyAll([new CreateAddressTask(), new CreateContactPersonTask()]);
  const updatedCustomer = await transaction.apply(new UpdateCustomerTask(customerGUID, results[0], results[1]));

  console.log(updatedCustomer);
} catch (e) {
  const revertResult = await transaction.revert();
  console.log(revertResult.success);
}
```
