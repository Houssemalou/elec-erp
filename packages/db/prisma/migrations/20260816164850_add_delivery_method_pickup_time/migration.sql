-- CreateEnum
CREATE TYPE "OnlineDeliveryMethod" AS ENUM ('DELIVERY', 'PICKUP');

-- AlterTable
ALTER TABLE "online_orders" ADD COLUMN     "deliveryMethod" "OnlineDeliveryMethod" NOT NULL DEFAULT 'DELIVERY',
ADD COLUMN     "pickupTime" TIMESTAMP(3);
