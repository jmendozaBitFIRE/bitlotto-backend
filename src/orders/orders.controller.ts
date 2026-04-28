import { Controller, Get, Patch, Param, Body, Request, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role } from '../auth/enums/role.enum';

@Controller('raffles/:raffleId/orders')
@UseGuards(RolesGuard)
@Roles(Role.ORGANIZADOR)
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Get()
  findAll(@Param('raffleId') raffleId: string, @Request() req) {
    return this.ordersService.findAllByRaffle(raffleId, req.user.id);
  }

  @Patch(':orderId/status')
  updateStatus(
    @Param('raffleId') raffleId: string,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateOrderStatusDto,
    @Request() req,
  ) {
    return this.ordersService.updateStatus(raffleId, orderId, req.user.id, dto);
  }
}
