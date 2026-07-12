import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { safeRead } from './utils.js';
import type { RawService } from './types.js';

export function detectJavaServices(dir: string): RawService[] {
  if (existsSync(join(dir, 'pom.xml'))) {
    const content = safeRead(join(dir, 'pom.xml'));
    const isSpringBoot = content.includes('spring-boot');
    const mvn = existsSync(join(dir, 'mvnw')) ? './mvnw' : 'mvn';
    const command = isSpringBoot ? `${mvn} spring-boot:run` : `${mvn} compile exec:java`;
    return [{ name: 'server', command, type: 'server' }];
  }

  const gradleFile = existsSync(join(dir, 'build.gradle'))
    ? 'build.gradle'
    : existsSync(join(dir, 'build.gradle.kts'))
      ? 'build.gradle.kts'
      : null;

  if (gradleFile) {
    const content = safeRead(join(dir, gradleFile));
    const isSpringBoot = content.includes('org.springframework.boot');
    const gradle = existsSync(join(dir, 'gradlew')) ? './gradlew' : 'gradle';
    const command = isSpringBoot ? `${gradle} bootRun` : `${gradle} run`;
    return [{ name: 'server', command, type: 'server' }];
  }

  return [];
}
