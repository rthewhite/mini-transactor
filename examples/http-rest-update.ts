import { ITask, Transaction } from '../src/transaction';

/*
 * Example http-rest-update
 * ----------------------------------------
 * Imagine you have to create a couple of entities and link them to each other
 * afterwards using their guids. But if anything goes wrong you would like to
 * revert everything and clean up so you don't end up with unrelated entities in
 * the backend. The example below show's this scenario.
 */
class CreateCustomerTask implements ITask<string> {
  private guid = '';

  public apply() {
    // Imagine you do an http post call here and store the result
    // on the task
    return Promise.resolve('1234567890')
      .then((guid) => {
        this.guid = guid;
        return guid;
      });
  }

  public revert() {
    // Imagine you do an HTTP delete call here using the stored guid
    return Promise.resolve(this.guid);
  }
}

class CreateAddressTask implements ITask<string> {
  private guid = '';

  public apply() {
    return Promise.resolve('1234567890')
      .then((guid) => {
        this.guid = guid;
        return guid;
      });
  }

  public revert() {
    return Promise.resolve(this.guid);
  }
}

class CreateContactPersonTask implements ITask<string> {
  private guid = '';

  public apply() {
    return Promise.resolve('1234567890')
      .then((guid) => {
        this.guid = guid;
        return guid;
      });
  }

  public revert() {
    return Promise.resolve(this.guid);
  }
}

class UpdateCustomerTask implements ITask<any> {
  constructor(private customerGUID: string,
              private addressGUID: string,
              private contactPersonGUID: string) {
    console.log('Updating customer', this.customerGUID, this.addressGUID, this.contactPersonGUID);
  }

  public apply() {
    // First retrieves the current state based on the customer guid
    // Store that state in previousState
    // Execute the update to attach address and contactperson guid
    return Promise.resolve();
  }
  public revert() {
    // Use the previousState stored to revert the change
    return Promise.resolve();
  }
}

export async function example() {
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
}
