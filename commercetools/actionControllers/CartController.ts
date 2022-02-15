import { Request, Response } from '@frontastic/extension-types/src/ts/index';
import { CartApi } from '../../commercetools/CartApi';
import { ActionContext } from '@frontastic/extension-types';
import { Cart } from '../../../types/cart/Cart';
import { LineItem } from '../../../types/cart/LineItem';
import { Address } from '../../../types/account/Address';
import { CartFetcher } from '../../utils/CartFetcher';
import { ShippingMethod } from '../../../types/cart/ShippingMethod';
import { Payment, PaymentStatuses } from '../../../../../saas/project-libraries/types/cart/Payment';

type ActionHook = (request: Request, actionContext: ActionContext) => Promise<Response>;

async function updateCartFromRequest(request: Request, actionContext: ActionContext): Promise<Cart> {
  const cartApi = new CartApi(actionContext.frontasticContext, request.query.locale);
  let cart = await CartFetcher.fetchCart(request, actionContext);

  if (request?.body === undefined || request?.body === '') {
    return cart;
  }

  const body: {
    account?: { email?: string };
    shipping?: Address;
    billing?: Address;
  } = JSON.parse(request.body);

  if (body?.account?.email !== undefined) {
    cart = await cartApi.setEmail(cart, body.account.email);
  }

  if (body?.shipping !== undefined || body?.billing !== undefined) {
    const shippingAddress = body?.shipping !== undefined ? body.shipping : body.billing;
    const billingAddress = body?.billing !== undefined ? body.billing : body.shipping;

    cart = await cartApi.setShippingAddress(cart, shippingAddress);
    cart = await cartApi.setBillingAddress(cart, billingAddress);
  }

  return cart;
}

export const getCart: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const cart = await CartFetcher.fetchCart(request, actionContext);
  const cartId = cart.cartId;

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(cart),
    sessionData: {
      ...request.sessionData,
      cartId,
    },
  };

  return response;
};

export const addToCart: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const cartApi = new CartApi(actionContext.frontasticContext, request.query.locale);

  const body: {
    variant?: { sku?: string; count: number };
  } = JSON.parse(request.body);

  const lineItem: LineItem = {
    variant: {
      sku: body.variant?.sku || undefined,
      price: undefined,
    },
    count: +body.variant?.count || 1,
  };

  let cart = await CartFetcher.fetchCart(request, actionContext);
  cart = await cartApi.addToCart(cart, lineItem);

  const cartId = cart.cartId;

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(cart),
    sessionData: {
      ...request.sessionData,
      cartId,
    },
  };

  return response;
};

export const updateLineItem: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const cartApi = new CartApi(actionContext.frontasticContext, request.query.locale);

  const body: {
    lineItem?: { id?: string; count: number };
  } = JSON.parse(request.body);

  const lineItem: LineItem = {
    lineItemId: body.lineItem?.id,
    count: +body.lineItem?.count || 1,
  };

  let cart = await CartFetcher.fetchCart(request, actionContext);
  cart = await cartApi.updateLineItem(cart, lineItem);

  const cartId = cart.cartId;

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(cart),
    sessionData: {
      ...request.sessionData,
      cartId,
    },
  };

  return response;
};

export const removeLineItem: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const cartApi = new CartApi(actionContext.frontasticContext, request.query.locale);

  const body: {
    lineItem?: { id?: string };
  } = JSON.parse(request.body);

  const lineItem: LineItem = {
    lineItemId: body.lineItem?.id,
  };

  let cart = await CartFetcher.fetchCart(request, actionContext);
  cart = await cartApi.removeLineItem(cart, lineItem);

  const cartId = cart.cartId;

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(cart),
    sessionData: {
      ...request.sessionData,
      cartId,
    },
  };

  return response;
};

export const updateCart: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const cart = await updateCartFromRequest(request, actionContext);
  const cartId = cart.cartId;

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(cart),
    sessionData: {
      ...request.sessionData,
      cartId,
    },
  };

  return response;
};

export const checkout: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const cartApi = new CartApi(actionContext.frontasticContext, request.query.locale);

  let cart = await updateCartFromRequest(request, actionContext);
  cart = await cartApi.order(cart);

  // Unset the cartId
  const cartId: string = undefined;

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(cart),
    sessionData: {
      ...request.sessionData,
      cartId,
    },
  };

  return response;
};

export const getShippingMethods: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const cartApi = new CartApi(actionContext.frontasticContext, request.query.locale);
  const cart = await CartFetcher.fetchCart(request, actionContext);
  const onlyMatching = request.query.onlyMatching === 'true';

  const shippingMethods = await cartApi.getShippingMethods(onlyMatching);

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(shippingMethods),
    sessionData: {
      ...request.sessionData,
      cartId: cart.cartId,
    },
  };

  return response;
};

export const getAvailableShippingMethods: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const cartApi = new CartApi(actionContext.frontasticContext, request.query.locale);
  const cart = await CartFetcher.fetchCart(request, actionContext);

  const availableShippingMethods = await cartApi.getAvailableShippingMethods(cart);

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(availableShippingMethods),
    sessionData: {
      ...request.sessionData,
      cartId: cart.cartId,
    },
  };

  return response;
};

export const setShippingMethod: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const cartApi = new CartApi(actionContext.frontasticContext, request.query.locale);
  let cart = await CartFetcher.fetchCart(request, actionContext);

  const body: {
    shippingMethod?: { id?: string };
  } = JSON.parse(request.body);

  const shippingMethod: ShippingMethod = {
    shippingMethodId: body.shippingMethod?.id,
  };

  cart = await cartApi.setShippingMethod(cart, shippingMethod);

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(cart),
    sessionData: {
      ...request.sessionData,
      cartId: cart.cartId,
    },
  };

  return response;
};

export const addPaymentByInvoice: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const cartApi = new CartApi(actionContext.frontasticContext, request.query.locale);
  let cart = await CartFetcher.fetchCart(request, actionContext);

  const paymentRequest: Payment = JSON.parse(request.body);

  if (paymentRequest.amountPlanned === undefined) {
    paymentRequest.amountPlanned = {};
  }

  paymentRequest.amountPlanned.centAmount = paymentRequest.amountPlanned.centAmount ?? cart.sum.centAmount ?? undefined;
  paymentRequest.amountPlanned.currencyCode =
    paymentRequest.amountPlanned.currencyCode ?? cart.sum.currencyCode ?? undefined;
  paymentRequest.paymentProvider = 'frontastic';
  paymentRequest.paymentMethod = 'invoice';
  paymentRequest.paymentStatus = PaymentStatuses.PENDING;

  cart = await cartApi.addPayment(cart, paymentRequest);

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(cart),
    sessionData: {
      ...request.sessionData,
      cartId: cart.cartId,
    },
  };

  return response;
};
