import { Module } from '@nestjs/common';
import { ApiController } from './api.controller';
import { ApiKeyService } from '../security/api-key.service';
import { MetadataModule } from '../metadata/metadata.module';
import { QueryService } from './query.service';
import { DatasourceService } from '../datasource/datasource.service';

@Module({
	imports: [MetadataModule],
	controllers: [ApiController],
	providers: [ApiKeyService, QueryService, DatasourceService],
})
export class ApiModule {}
