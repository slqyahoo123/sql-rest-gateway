import { Module } from '@nestjs/common';
import { MetadataModule } from '../metadata/metadata.module';
import { AdminController } from './admin.controller';

@Module({
	imports: [MetadataModule],
	controllers: [AdminController],
})
export class AdminModule {}
