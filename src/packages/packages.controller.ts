import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PackagesService } from './packages.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role } from '../auth/enums/role.enum';

@Controller('admin/clients/:clientId/packages')
@UseGuards(RolesGuard)
@Roles(Role.SUPERADMIN)
export class PackagesController {
  constructor(private packagesService: PackagesService) {}

  @Get()
  findAll(@Param('clientId') clientId: string) {
    return this.packagesService.findByClient(clientId);
  }

  @Post()
  create(@Param('clientId') clientId: string, @Body() dto: CreatePackageDto) {
    return this.packagesService.create(clientId, dto);
  }

  @Patch(':id')
  update(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePackageDto,
  ) {
    return this.packagesService.update(clientId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('clientId') clientId: string, @Param('id') id: string) {
    return this.packagesService.remove(clientId, id);
  }
}
