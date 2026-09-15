import { Controller, Get } from '@nestjs/common';
import { Public } from '@fsarch/server/auth';

@Controller('health')
export class HealthController {
  @Get()
  @Public()
  public healthCheck(): { status: string; timestamp: Date } {
    return { status: 'healthy', timestamp: new Date() };
  }
}
