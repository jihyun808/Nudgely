#!/bin/sh
# Xcode Cloud 가 ci_scripts 를 저장소 루트에서 찾는지, Xcode 프로젝트 옆에서
# 찾는지 문서가 엇갈린다. 양쪽에 두되 내용은 한 곳에만 둔다.
exec "$CI_PRIMARY_REPOSITORY_PATH/ci_scripts/ci_post_clone.sh" "$@"
