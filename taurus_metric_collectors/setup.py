from setuptools import setup, find_packages

requirements = [line.strip() for line in open("requirements.txt")]

name = "taurus_metric_collectors"

setup(
  name = name,
  description = "Taurus Metric Collectors",
  packages = find_packages(),
  install_requires = requirements,
  entry_points = {
    "console_scripts": [
      ("taurus-collectors-metric-maintenance-agent = "
       "%s.common_services.metric_maintenance_agent:main" % name),
      "taurus-xignite-agent = %s.xignite.xignite_stock_agent:main" % name,
      ("taurus-twitterdirect-agent = "
       "%s.twitterdirect.twitter_direct_agent:main" % name),
      ("taurus-process-tweet-deletions = "
       "%s.twitterdirect.process_tweet_deletions:main" % name),
      ("taurus-purge-old-tweets = "
       "%s.twitterdirect.purge_old_tweets:main" % name),
      ("taurus-set-collectorsdb-login = "
       "%s.collectorsdb.set_collectorsdb_login:main" % name),
      ("taurus-reset-collectorsdb = "
       "%s.collectorsdb:resetCollectorsdbMain" % name),
      "taurus-collectors-set-opmode = %s.set_collectors_opmode:main" % name,
      "taurus-collectors-set-rabbitmq = %s.set_rabbitmq_login:main" % name,
      "taurus-create-models = %s.create_models:main" % name,
      "taurus-delete-metric = %s.delete_metric:main" % name,
      "taurus-unmonitor-metrics = %s.unmonitor_metrics:main" % name,
      "taurus-monitor-metrics = %s.monitor_metrics:main" % name,
      ("taurus-check-twitter-screen-names = "
       "%s.twitterdirect.check_twitter_screen_names:main" % name),
      ("taurus-check-company-symbols = "
       "%s.xignite.check_company_symbols:main" % name),
    ]
  }
)
