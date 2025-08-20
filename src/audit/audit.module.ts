import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { MetadataModule } from '../metadata/metadata.module';

@Module({
	imports: [MetadataModule],
	providers: [AuditService],
	exports: [AuditService],
})
export class AuditModule {}
