import { Request, Response } from '@frontastic/extension-types/src/ts/index';
import { ActionContext } from '@frontastic/extension-types';
import { AccountApi } from '../AccountApi';
import { Account } from '../../../types/account/Account';
import { Address } from '../../../types/account/Address';
import { CartFetcher } from '../../utils/CartFetcher';
import { getLocale } from '../../utils/Request';
import { EmailApi } from '../EmailApi';

type ActionHook = (request: Request, actionContext: ActionContext) => Promise<Response>;

type AccountRegisterBody = {
  email?: string;
  password?: string;
  salutation?: string;
  firstName?: string;
  lastName?: string;
  birthdayYear?: string;
  birthdayMonth?: string;
  birthdayDay?: string;
  billingAddress?: Address;
  shippingAddress?: Address;
};

type AccountLoginBody = {
  email?: string;
  password?: string;
};

type AccountChangePasswordBody = {
  oldPassword: string;
  newPassword: string;
};

async function loginAccount(request: Request, actionContext: ActionContext, account: Account) {
  const accountApi = new AccountApi(actionContext.frontasticContext, getLocale(request));

  const cart = await CartFetcher.fetchCart(request, actionContext);

  return await accountApi.login(account, cart);
}

function assertIsAuthenticated(request: Request) {
  const account = fetchAccountFromSession(request);

  if (account === undefined) {
    throw new Error('Not logged in.');
  }
}

function fetchAccountFromSession(request: Request): Account | undefined {
  if (request.sessionData?.account !== undefined) {
    return request.sessionData.account;
  }

  return undefined;
}

function parseBirthday(accountRegisterBody: AccountRegisterBody): Date | undefined {
  if (accountRegisterBody.birthdayYear) {
    return new Date(
      +accountRegisterBody.birthdayYear,
      +accountRegisterBody?.birthdayMonth ?? 1,
      +accountRegisterBody?.birthdayDay ?? 1,
    );
  }

  return null;
}

function mapRequestToAccount(request: Request): Account {
  const accountRegisterBody: AccountRegisterBody = JSON.parse(request.body);

  const account: Account = {
    email: accountRegisterBody?.email,
    password: accountRegisterBody?.password,
    salutation: accountRegisterBody?.salutation,
    firstName: accountRegisterBody?.firstName,
    lastName: accountRegisterBody?.lastName,
    birthday: parseBirthday(accountRegisterBody),
    addresses: [],
  };

  if (accountRegisterBody.billingAddress) {
    accountRegisterBody.billingAddress.isDefaultBillingAddress = true;
    accountRegisterBody.billingAddress.isDefaultShippingAddress = !(accountRegisterBody.shippingAddress !== undefined);

    account.addresses.push(accountRegisterBody.billingAddress);
  }

  if (accountRegisterBody.shippingAddress) {
    accountRegisterBody.shippingAddress.isDefaultShippingAddress = true;
    accountRegisterBody.shippingAddress.isDefaultBillingAddress = !(accountRegisterBody.billingAddress !== undefined);

    account.addresses.push(accountRegisterBody.shippingAddress);
  }

  return account;
}

export const getAccount: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const account = fetchAccountFromSession(request);

  if (account === undefined) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        loggedIn: false,
      }),
    };
  }

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify({
      loggedIn: true,
      account,
    }),
    sessionData: {
      ...request.sessionData,
      account: account,
    },
  };

  return response;
};

export const register: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const accountApi = new AccountApi(actionContext.frontasticContext, getLocale(request));

  const accountData = mapRequestToAccount(request);

  const cart = await CartFetcher.fetchCart(request, actionContext);

  let account = await accountApi.create(accountData, cart);

  if (account.confirmationToken !== undefined) {
    const emailApi = new EmailApi();

    //Verification url
    const host = process.env.NODE_ENV === 'development' ? 'localhost:3000' : process.env.client_host;
    const path = `verify?token=${account.confirmationToken}`;
    const url = `${host}/${path}`;

    await emailApi.sendEmail({
      from: 'no-reply@frontastic.cloud',
      to: account.email,
      subject: 'Account verification',
      html: `
              <h1>Thanks for your registration!</h1>
              <p style="margin-top: 10px;color:gray;">Please activate your account by clicking the below link</p>
              <a href="${url}">${url}</a>
            `,
    });
  }

  // TODO: do we need to log in the account after creation?
  // TODO: handle exception when customer can't login if email is not confirmed
  account = await loginAccount(request, actionContext, accountData);

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(account),
    sessionData: {
      ...request.sessionData,
      account: account,
    },
  };

  return response;
};

export const confirm: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const accountApi = new AccountApi(actionContext.frontasticContext, getLocale(request));

  type AccountConfirmBody = {
    token?: string;
  };

  const accountConfirmBody: AccountConfirmBody = JSON.parse(request.body);

  const account = await accountApi.confirmEmail(accountConfirmBody.token);

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(account),
    sessionData: {
      ...request.sessionData,
      account: account,
    },
  };

  return response;
};

export const login: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const accountLoginBody: AccountLoginBody = JSON.parse(request.body);

  let account = {
    email: accountLoginBody.email,
    password: accountLoginBody.password,
  } as Account;

  account = await loginAccount(request, actionContext, account);

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(account),
    sessionData: {
      ...request.sessionData,
      account: account,
    },
  };

  return response;
};

export const logout: ActionHook = async (request: Request, actionContext: ActionContext) => {
  return {
    statusCode: 200,
    body: JSON.stringify({}),
    sessionData: {
      ...request.sessionData,
      account: undefined,
    },
  } as Response;
};

/**
 * Change password
 */
export const password: ActionHook = async (request: Request, actionContext: ActionContext) => {
  assertIsAuthenticated(request);

  let account = fetchAccountFromSession(request);

  const accountApi = new AccountApi(actionContext.frontasticContext, getLocale(request));

  const accountChangePasswordBody: AccountChangePasswordBody = JSON.parse(request.body);

  account = await accountApi.updatePassword(
    account,
    accountChangePasswordBody.oldPassword,
    accountChangePasswordBody.newPassword,
  );

  return {
    statusCode: 200,
    body: JSON.stringify(account),
    sessionData: {
      ...request.sessionData,
      account,
    },
  } as Response;
};

/**
 * Request new reset token
 */
export const requestReset: ActionHook = async (request: Request, actionContext: ActionContext) => {
  type AccountRequestResetBody = {
    email?: string;
  };

  const accountRequestResetBody: AccountRequestResetBody = JSON.parse(request.body);

  const accountApi = new AccountApi(actionContext.frontasticContext, getLocale(request));

  const passwordResetToken = await accountApi.generatePasswordResetToken(accountRequestResetBody.email);

  // TODO: send email to user with token info
  return {
    statusCode: 200,
    body: JSON.stringify({}),
    sessionData: {
      ...request.sessionData,
      // TODO: should we redirect to logout rather to unset the account?
      account: undefined,
    },
  } as Response;
};

/**
 * Reset password
 */
export const reset: ActionHook = async (request: Request, actionContext: ActionContext) => {
  type AccountResetBody = {
    token?: string;
    newPassword?: string;
  };

  const accountResetBody: AccountResetBody = JSON.parse(request.body);

  const accountApi = new AccountApi(actionContext.frontasticContext, getLocale(request));

  let account = await accountApi.resetPassword(accountResetBody.token, accountResetBody.newPassword);
  account.password = accountResetBody.newPassword;

  // TODO: do we need to log in the account after creation?
  // TODO: handle exception when customer can't login if email is not confirmed
  account = await loginAccount(request, actionContext, account);

  return {
    statusCode: 200,
    body: JSON.stringify(account),
    sessionData: {
      ...request.sessionData,
      account: account,
    },
  } as Response;
};

export const update: ActionHook = async (request: Request, actionContext: ActionContext) => {
  assertIsAuthenticated(request);

  let account = fetchAccountFromSession(request);

  const accountApi = new AccountApi(actionContext.frontasticContext, getLocale(request));

  account = {
    ...account,
    ...mapRequestToAccount(request),
  };

  account = await accountApi.update(account);

  return {
    statusCode: 200,
    body: JSON.stringify(account),
    sessionData: {
      ...request.sessionData,
      account,
    },
  } as Response;
};

export const addAddress: ActionHook = async (request: Request, actionContext: ActionContext) => {
  assertIsAuthenticated(request);

  let account = fetchAccountFromSession(request);

  const address: Address = JSON.parse(request.body);

  const accountApi = new AccountApi(actionContext.frontasticContext, getLocale(request));

  account = await accountApi.addAddress(account, address);

  return {
    statusCode: 200,
    body: JSON.stringify(account),
    sessionData: {
      ...request.sessionData,
      account,
    },
  } as Response;
};

export const updateAddress: ActionHook = async (request: Request, actionContext: ActionContext) => {
  assertIsAuthenticated(request);

  let account = fetchAccountFromSession(request);

  const address: Address = JSON.parse(request.body);

  const accountApi = new AccountApi(actionContext.frontasticContext, getLocale(request));

  account = await accountApi.updateAddress(account, address);

  return {
    statusCode: 200,
    body: JSON.stringify(account),
    sessionData: {
      ...request.sessionData,
      account,
    },
  } as Response;
};

export const removeAddress: ActionHook = async (request: Request, actionContext: ActionContext) => {
  assertIsAuthenticated(request);

  let account = fetchAccountFromSession(request);

  const address: Address = JSON.parse(request.body);

  const accountApi = new AccountApi(actionContext.frontasticContext, getLocale(request));

  account = await accountApi.removeAddress(account, address);

  return {
    statusCode: 200,
    body: JSON.stringify(account),
    sessionData: {
      ...request.sessionData,
      account,
    },
  } as Response;
};

export const setDefaultBillingAddress: ActionHook = async (request: Request, actionContext: ActionContext) => {
  assertIsAuthenticated(request);

  let account = fetchAccountFromSession(request);

  const address: Address = JSON.parse(request.body);

  const accountApi = new AccountApi(actionContext.frontasticContext, getLocale(request));

  account = await accountApi.setDefaultBillingAddress(account, address);

  return {
    statusCode: 200,
    body: JSON.stringify(account),
    sessionData: {
      ...request.sessionData,
      account,
    },
  } as Response;
};

export const setDefaultShippingAddress: ActionHook = async (request: Request, actionContext: ActionContext) => {
  assertIsAuthenticated(request);

  let account = fetchAccountFromSession(request);

  const address: Address = JSON.parse(request.body);

  const accountApi = new AccountApi(actionContext.frontasticContext, getLocale(request));

  account = await accountApi.setDefaultShippingAddress(account, address);

  return {
    statusCode: 200,
    body: JSON.stringify(account),
    sessionData: {
      ...request.sessionData,
      account,
    },
  } as Response;
};
