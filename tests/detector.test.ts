import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectServices } from '../src/core/detector.js';

describe('detectServices', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'sift-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('detects standard scripts from package.json', () => {
    const pkg = {
      scripts: {
        dev: 'next dev',
        server: 'nodemon src/index.js',
        expo: 'expo start --clear',
        db: 'docker compose up postgres',
        stripe: 'stripe listen --forward-to localhost:3000/webhook',
      },
    };
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify(pkg));

    const services = detectServices({ packagePath: join(tempDir, 'package.json') });
    const names = services.map((s) => s.name).sort();
    expect(names).toEqual(['api', 'db', 'mobile', 'stripe', 'web']);
  });

  it('disambiguates duplicate script names by directory', () => {
    const rootPkg = { scripts: { dev: 'next dev' } };
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify(rootPkg));

    const dashboardDir = join(tempDir, 'dashboard');
    mkdirSync(dashboardDir);
    const dashboardPkg = { scripts: { dev: 'vite' } };
    writeFileSync(join(dashboardDir, 'package.json'), JSON.stringify(dashboardPkg));

    const services = detectServices({ packagePath: join(tempDir, 'package.json') });
    const names = services.map((s) => s.name).sort();
    expect(names).toEqual(['dashboard-web', 'web']);
  });

  it('returns empty array when package.json is missing', () => {
    const services = detectServices({ packagePath: join(tempDir, 'missing.json') });
    expect(services).toEqual([]);
  });

  it('assigns unique colors', () => {
    const pkg = {
      scripts: {
        dev: 'next dev',
        server: 'nodemon src/index.js',
        expo: 'expo start',
      },
    };
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify(pkg));

    const services = detectServices({ packagePath: join(tempDir, 'package.json') });
    const colors = services.map((s) => s.color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  describe('python', () => {
    it('detects a Django project and its Celery worker', () => {
      writeFileSync(join(tempDir, 'manage.py'), '#!/usr/bin/env python');
      writeFileSync(join(tempDir, 'requirements.txt'), 'django\ncelery\n');

      const services = detectServices({ packagePath: join(tempDir, 'package.json') });
      expect(services).toHaveLength(2);
      expect(services.find((s) => s.name === 'server')?.command).toBe('python manage.py runserver');
      expect(services.find((s) => s.name === 'worker')?.command).toBe(
        'celery -A app worker -l info',
      );
    });

    it('detects a FastAPI app and builds an uvicorn command', () => {
      writeFileSync(join(tempDir, 'requirements.txt'), 'fastapi\nuvicorn\n');
      writeFileSync(join(tempDir, 'main.py'), 'from fastapi import FastAPI\napp = FastAPI()\n');

      const services = detectServices({ packagePath: join(tempDir, 'package.json') });
      expect(services).toHaveLength(1);
      expect(services[0].command).toBe('uvicorn main:app --reload');
      expect(services[0].type).toBe('server');
    });

    it('detects a Flask app', () => {
      writeFileSync(join(tempDir, 'requirements.txt'), 'flask\n');
      writeFileSync(join(tempDir, 'app.py'), 'from flask import Flask\napp = Flask(__name__)\n');

      const services = detectServices({ packagePath: join(tempDir, 'package.json') });
      expect(services).toHaveLength(1);
      expect(services[0].command).toBe('flask --app app run --debug');
    });

    it('prefixes commands with poetry run when poetry.lock is present', () => {
      writeFileSync(join(tempDir, 'pyproject.toml'), '[tool.poetry]\nname = "svc"\n');
      writeFileSync(join(tempDir, 'poetry.lock'), '');
      writeFileSync(join(tempDir, 'manage.py'), '');

      const services = detectServices({ packagePath: join(tempDir, 'package.json') });
      expect(services[0].command).toBe('poetry run python manage.py runserver');
    });
  });

  describe('go', () => {
    it('detects a root main.go module', () => {
      writeFileSync(join(tempDir, 'go.mod'), 'module github.com/example/thing\n\ngo 1.22\n');
      writeFileSync(join(tempDir, 'main.go'), 'package main\n');

      const services = detectServices({ packagePath: join(tempDir, 'package.json') });
      expect(services).toHaveLength(1);
      expect(services[0].name).toBe('thing');
      expect(services[0].command).toBe('go run .');
    });

    it('detects multiple cmd/ entrypoints', () => {
      writeFileSync(join(tempDir, 'go.mod'), 'module github.com/example/thing\n');
      mkdirSync(join(tempDir, 'cmd', 'api'), { recursive: true });
      mkdirSync(join(tempDir, 'cmd', 'worker'), { recursive: true });
      writeFileSync(join(tempDir, 'cmd', 'api', 'main.go'), 'package main\n');
      writeFileSync(join(tempDir, 'cmd', 'worker', 'main.go'), 'package main\n');

      const services = detectServices({ packagePath: join(tempDir, 'package.json') });
      const names = services.map((s) => s.name).sort();
      expect(names).toEqual(['api', 'worker']);
      expect(services.find((s) => s.name === 'api')?.command).toBe('go run ./cmd/api');
      expect(services.find((s) => s.name === 'worker')?.type).toBe('worker');
    });
  });

  describe('ruby', () => {
    it('detects a Rails app with Sidekiq', () => {
      writeFileSync(join(tempDir, 'Gemfile'), 'gem "rails"\ngem "sidekiq"\n');
      mkdirSync(join(tempDir, 'bin'));
      writeFileSync(join(tempDir, 'bin', 'rails'), '#!/usr/bin/env ruby');

      const services = detectServices({ packagePath: join(tempDir, 'package.json') });
      expect(services.find((s) => s.name === 'server')?.command).toBe('bin/rails server');
      expect(services.find((s) => s.name === 'worker')?.command).toBe('bundle exec sidekiq');
    });

    it('falls back to rackup for a plain Rack app', () => {
      writeFileSync(join(tempDir, 'Gemfile'), 'gem "sinatra"\n');
      writeFileSync(join(tempDir, 'config.ru'), 'run App\n');

      const services = detectServices({ packagePath: join(tempDir, 'package.json') });
      expect(services).toHaveLength(1);
      expect(services[0].command).toBe('bundle exec rackup');
    });
  });

  describe('rust', () => {
    it('detects a Cargo package', () => {
      writeFileSync(join(tempDir, 'Cargo.toml'), '[package]\nname = "myapp"\nversion = "0.1.0"\n');

      const services = detectServices({ packagePath: join(tempDir, 'package.json') });
      expect(services).toHaveLength(1);
      expect(services[0].name).toBe('myapp');
      expect(services[0].command).toBe('cargo run');
    });

    it('detects multiple [[bin]] targets', () => {
      writeFileSync(
        join(tempDir, 'Cargo.toml'),
        '[package]\nname = "myapp"\n\n[[bin]]\nname = "api"\npath = "src/api.rs"\n\n[[bin]]\nname = "worker"\npath = "src/worker.rs"\n',
      );

      const services = detectServices({ packagePath: join(tempDir, 'package.json') });
      const names = services.map((s) => s.name).sort();
      expect(names).toEqual(['api', 'worker']);
    });
  });

  describe('php', () => {
    it('detects a Laravel app with a queue worker', () => {
      writeFileSync(join(tempDir, 'composer.json'), '{}');
      writeFileSync(join(tempDir, 'artisan'), '#!/usr/bin/env php');
      mkdirSync(join(tempDir, 'config'));
      writeFileSync(join(tempDir, 'config', 'queue.php'), '<?php return [];');

      const services = detectServices({ packagePath: join(tempDir, 'package.json') });
      expect(services.find((s) => s.name === 'server')?.command).toBe('php artisan serve');
      expect(services.find((s) => s.name === 'worker')?.command).toBe('php artisan queue:work');
    });
  });

  describe('java', () => {
    it('detects a Spring Boot Maven project', () => {
      writeFileSync(
        join(tempDir, 'pom.xml'),
        '<project><parent><artifactId>spring-boot-starter-parent</artifactId></parent></project>',
      );

      const services = detectServices({ packagePath: join(tempDir, 'package.json') });
      expect(services).toHaveLength(1);
      expect(services[0].command).toBe('mvn spring-boot:run');
    });

    it('detects a Gradle project using the wrapper when present', () => {
      writeFileSync(join(tempDir, 'build.gradle'), "plugins { id 'application' }");
      writeFileSync(join(tempDir, 'gradlew'), '#!/bin/sh');

      const services = detectServices({ packagePath: join(tempDir, 'package.json') });
      expect(services[0].command).toBe('./gradlew run');
    });
  });

  describe('.NET', () => {
    it('detects a csproj project', () => {
      writeFileSync(join(tempDir, 'MyApp.csproj'), '<Project Sdk="Microsoft.NET.Sdk" />');

      const services = detectServices({ packagePath: join(tempDir, 'package.json') });
      expect(services).toHaveLength(1);
      expect(services[0].name).toBe('MyApp');
      expect(services[0].command).toBe('dotnet run');
    });
  });

  describe('Procfile', () => {
    it('detects web and worker processes and skips release', () => {
      writeFileSync(
        join(tempDir, 'Procfile'),
        'web: gunicorn app:app\nworker: celery -A app worker\nrelease: python manage.py migrate\n',
      );

      const services = detectServices({ packagePath: join(tempDir, 'package.json') });
      const names = services.map((s) => s.name).sort();
      expect(names).toEqual(['web', 'worker']);
      expect(services.find((s) => s.name === 'web')?.type).toBe('server');
      expect(services.find((s) => s.name === 'worker')?.type).toBe('worker');
    });
  });

  it('returns empty array for a directory with no recognizable project files', () => {
    writeFileSync(join(tempDir, 'README.md'), '# hello');
    const services = detectServices({ packagePath: join(tempDir, 'package.json') });
    expect(services).toEqual([]);
  });
});
