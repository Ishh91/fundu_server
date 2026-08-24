import { User } from './User.js';
import { Product } from './Product.js';
import { SparePart } from './SparePart.js';
import { SellRequest } from './SellRequest.js';
import { SellPriceConfig } from './SellPriceConfig.js';
import { RepairBooking } from './RepairBooking.js';
import { Order } from './Order.js';
import { Dispatch } from './Dispatch.js';
import { Review } from './Review.js';
import { SupportTicket } from './SupportTicket.js';
import { DeliveryAgent } from './DeliveryAgent.js';
import { MasterPhone } from './MasterPhone.js';
import { SiteContent } from './SiteContent.js';
import { WholesaleInventory } from './WholesaleInventory.js';
import { WholesaleOrder } from './WholesaleOrder.js';
import { VendorLedger } from './VendorLedger.js';

export {
  User,
  Product,
  SparePart,
  SellRequest,
  SellPriceConfig,
  RepairBooking,
  Order,
  Dispatch,
  Review,
  SupportTicket,
  DeliveryAgent,
  MasterPhone,
  SiteContent,
  WholesaleInventory,
  WholesaleOrder,
  VendorLedger,
};

export const TABLE_MODELS = {
  profiles: User,
  products: Product,
  spare_parts: SparePart,
  sell_requests: SellRequest,
  sell_price_configs: SellPriceConfig,
  repair_bookings: RepairBooking,
  orders: Order,
  dispatches: Dispatch,
  reviews: Review,
  support_tickets: SupportTicket,
  delivery_agents: DeliveryAgent,
  master_phones: MasterPhone,
  phones: MasterPhone,
  site_content: SiteContent,
  banners: SiteContent,
  wholesale_inventories: WholesaleInventory,
  wholesale_inventory: WholesaleInventory,
  wholesale_orders: WholesaleOrder,
  vendor_ledgers: VendorLedger,
  vendor_ledger: VendorLedger,
};

export const getModel = (table) => {
  const model = TABLE_MODELS[table];
  if (!model) {
    const error = new Error(`Unknown table: ${table}`);
    error.status = 404;
    throw error;
  }
  return model;
};
